// Caché de teselas de OpenStreetMap del service worker: solo las que la persona ya vio, con un
// límite, sin descargas masivas (política de uso de las teselas de OSM).
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import type { WorkboxPlugin } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';

export const CACHE_DE_TESELAS = 'teselas-osm';

export const esTesela = ({ url }: { readonly url: URL }): boolean =>
  url.hostname === 'tile.openstreetmap.org';

export const pluginsDeTeselas = (): WorkboxPlugin[] => [
  // Leaflet pide las teselas con <img> sin CORS: llegan como respuesta opaca (estado 0), que
  // Workbox no guarda por defecto. Sin esto la caché queda vacía y el mapa no se ve sin conexión.
  // Los tipos de Workbox no contemplan exactOptionalPropertyTypes; los plugins son los oficiales.
  new CacheableResponsePlugin({ statuses: [0, 200] }) as never,
  new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60 }) as never,
];
