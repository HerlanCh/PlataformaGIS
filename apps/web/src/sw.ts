/// <reference lib="webworker" />
// Service worker de la PWA (vite-plugin-pwa, modo injectManifest).
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { avisoDeReporte } from './services/aviso.js';
import { enviarPendientes, ETIQUETA_DE_SINCRONIZACION } from './services/cola.js';

declare const self: ServiceWorkerGlobalScope;

// La app completa queda disponible sin conexión.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Teselas de OpenStreetMap: solo las que la persona ya vio, con un límite, sin descargas masivas
// (política de uso de las teselas de OSM).
registerRoute(
  ({ url }) => url.hostname === 'tile.openstreetmap.org',
  new CacheFirst({
    cacheName: 'teselas-osm',
    // Los tipos de Workbox no contemplan exactOptionalPropertyTypes; el plugin es el oficial.
    plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60 }) as never],
  }),
);

const URL_API: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface EventoDeSincronizacion extends ExtendableEvent {
  readonly tag: string;
}

// Background Sync (HU-05): al volver la señal, el navegador despierta al service worker para que
// envíe la cola aunque la app esté cerrada.
self.addEventListener('sync', ((evento: EventoDeSincronizacion) => {
  if (evento.tag !== ETIQUETA_DE_SINCRONIZACION) return;
  evento.waitUntil(
    enviarPendientes(URL_API).then(async (resultados) => {
      // Si alguno sigue sin poder enviarse, el navegador reintentará la sincronización.
      if (resultados.some((r) => r.resultado.tipo === 'PENDIENTE')) {
        throw new Error('quedan reportes pendientes');
      }
      for (const cliente of await self.clients.matchAll())
        cliente.postMessage({ tipo: 'cola-enviada' });
    }),
  );
}) as EventListener);

// Avisos de las zonas (HU-08): el aviso solo trae la categoría y la ubicación pública.
self.addEventListener('push', (evento) => {
  const aviso = avisoDeReporte(evento.data?.json() as unknown);
  if (!aviso) return;
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.cuerpo,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Un reporte se avisa una vez: si llega repetido, reemplaza al anterior.
      tag: aviso.etiqueta,
      lang: 'es-BO',
      data: { url: aviso.url },
    }),
  );
});

// Tocar el aviso abre la app en el reporte, o la trae al frente si ya estaba abierta.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = (evento.notification.data as { url?: string } | null)?.url ?? '/';
  evento.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const ventana = abiertas[0];
      if (!ventana) {
        await self.clients.openWindow(url);
        return;
      }
      ventana.postMessage({ tipo: 'abrir-reporte', url });
      await ventana.focus();
    })(),
  );
});

self.addEventListener('message', (evento) => {
  if ((evento.data as { tipo?: string } | null)?.tipo === 'SKIP_WAITING') void self.skipWaiting();
});
