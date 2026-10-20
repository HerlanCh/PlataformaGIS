import { lazy, Suspense, useEffect, useMemo } from 'react';
import { URL_API } from './configuracion.js';
import { filtrarReportes } from './domain/filtros.js';
import type { Punto } from './domain/geo.js';
import type { ReportePublico } from './domain/reportes.js';
import { useEstado } from './estado.js';
import { HojaDeFiltros } from './features/filtros/HojaDeFiltros.js';
import { HojaDeCategorias } from './features/reporte/HojaDeCategorias.js';
import { HojaDeDetalle } from './features/votos/HojaDeDetalle.js';
import { useMapaDeCalor } from './features/calor/usarMapaDeCalor.js';
import { PanelCerca } from './features/cerca/PanelCerca.js';
import { useOrigen } from './features/cerca/usarOrigen.js';
import { Mapa } from './features/mapa/Mapa.js';
import { useReportesEnVentana, useTiempoReal } from './features/mapa/usarReportes.js';
import { useEnviarCola, useReportar } from './features/reporte/usarReportar.js';
import { AvisoSigueAhi } from './features/votos/AvisoSigueAhi.js';
import { useSeguirPosicion } from './features/votos/usarSigueAhi.js';
import { useZonas } from './features/zonas/usarZonas.js';
import type { Zona } from './features/zonas/usarZonas.js';
import { pendientes } from './services/cola.js';
import { obtenerToken } from './services/sesion.js';
import { Avisos } from './ui/Avisos.js';
import { Encabezado } from './ui/Encabezado.js';

// Lo que solo funciona con conexión (zonas, instalar) se descarga al usarlo. Reportar, el detalle
// y los filtros quedan en el JS inicial: tienen que andar sin señal aunque el service worker aún
// no haya guardado la app (HU-05).
const HojaDeZonas = lazy(() =>
  import('./features/zonas/HojaDeZonas.js').then((m) => ({ default: m.HojaDeZonas })),
);
const HojaDeInstalar = lazy(() =>
  import('./features/instalar/HojaDeInstalar.js').then((m) => ({ default: m.HojaDeInstalar })),
);
const HojaDeDescripcion = lazy(() =>
  import('./features/reporte/HojaDeDescripcion.js').then((m) => ({
    default: m.HojaDeDescripcion,
  })),
);
const EditorDeZona = lazy(() =>
  import('./features/zonas/EditorDeZona.js').then((m) => ({ default: m.EditorDeZona })),
);

/** Las hojas, montadas solo mientras están abiertas. */
function Hojas({ reportes }: { readonly reportes: readonly ReportePublico[] }) {
  const reportar = useReportar();
  const categorias = useEstado((s) => s.hojaAbierta);
  const detalle = useEstado((s) => s.detalle !== null);
  const filtros = useEstado((s) => s.filtrosAbiertos);
  const zonas = useEstado((s) => s.zonasAbiertas);
  const instalar = useEstado((s) => s.instalarAbierta);
  const describiendo = useEstado((s) => s.describiendo);
  return (
    <Suspense fallback={null}>
      {categorias && <HojaDeCategorias alElegir={(codigo) => void reportar(codigo)} />}
      {detalle && <HojaDeDetalle reportes={reportes} />}
      {filtros && <HojaDeFiltros />}
      {zonas && <HojaDeZonas />}
      {instalar && <HojaDeInstalar />}
      {describiendo && <HojaDeDescripcion idReporte={describiendo} />}
    </Suspense>
  );
}

/** Al abrir y al volver la señal, se registra el dispositivo y se envía lo que quedó pendiente. */
function usePuestaEnMarcha() {
  const enviarCola = useEnviarCola();
  useEffect(() => {
    const ponerAlDia = async () => {
      useEstado.getState().fijarPendientes((await pendientes()).length);
      await obtenerToken(URL_API).catch(() => undefined);
      if ((await pendientes()).length > 0) await enviarCola();
    };
    void ponerAlDia();
    const alVolverLaSenal = () => void ponerAlDia();
    // El service worker avisa cuando envió la cola en segundo plano (Background Sync).
    const alMensaje = (e: MessageEvent<{ tipo?: string }>) => {
      if (e.data?.tipo === 'cola-enviada') void ponerAlDia();
    };
    window.addEventListener('online', alVolverLaSenal);
    navigator.serviceWorker?.addEventListener('message', alMensaje);
    return () => {
      window.removeEventListener('online', alVolverLaSenal);
      navigator.serviceWorker?.removeEventListener('message', alMensaje);
    };
  }, [enviarCola]);
}

const SIN_REPORTES: readonly ReportePublico[] = [];
const SIN_ZONAS: readonly Zona[] = [];

/** Lee `?reporte=<id>&lat=&lon=` (al tocar un aviso push) y limpia la URL. */
export function destinoDeLaUrl(busqueda: string): { idReporte: string; punto: Punto } | null {
  const parametros = new URLSearchParams(busqueda);
  const idReporte = parametros.get('reporte');
  const [lat, lon] = [parametros.get('lat'), parametros.get('lon')];
  if (!idReporte || !lat || !lon) return null;
  const [latitud, longitud] = [Number(lat), Number(lon)];
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  return { idReporte, punto: { latitud, longitud } };
}

/**
 * Tocar un aviso push abre la app en el reporte: el mapa va a su ubicación pública y, cuando el
 * reporte llega con la ventana, se abre su detalle.
 */
function useDestinoDeAviso(reportes: readonly ReportePublico[]) {
  const destino = useEstado((s) => s.destino);

  useEffect(() => {
    const inicial = destinoDeLaUrl(globalThis.location.search);
    if (inicial) {
      useEstado.getState().irAReporte(inicial.idReporte, inicial.punto);
      globalThis.history.replaceState(null, '', globalThis.location.pathname);
    }
    const alMensaje = (e: MessageEvent<{ tipo?: string; url?: string }>) => {
      if (e.data?.tipo !== 'abrir-reporte' || !e.data.url) return;
      const elegido = destinoDeLaUrl(new URL(e.data.url, globalThis.location.href).search);
      if (elegido) useEstado.getState().irAReporte(elegido.idReporte, elegido.punto);
    };
    navigator.serviceWorker?.addEventListener('message', alMensaje);
    return () => navigator.serviceWorker?.removeEventListener('message', alMensaje);
  }, []);

  useEffect(() => {
    if (!destino || !reportes.some((r) => r.id === destino.idReporte)) return;
    useEstado.getState().abrirDetalle(destino.idReporte);
    useEstado.getState().limpiarDestino();
  }, [destino, reportes]);
}

/** Reportes de la ventana con los filtros aplicados, y cuántos quedaron fuera. */
function useReportesVisibles() {
  const consulta = useReportesEnVentana();
  const filtros = useEstado((s) => s.filtros);
  const todos = consulta.data ?? SIN_REPORTES;
  const visibles = useMemo(() => filtrarReportes(todos, filtros), [todos, filtros]);
  return { consulta, todos, visibles, ocultos: todos.length - visibles.length };
}

/** Pantalla principal: mapa en vivo, lo que pasa cerca, el reporte en dos toques y las zonas. */
export function App() {
  usePuestaEnMarcha();
  useTiempoReal();
  useSeguirPosicion();
  const { consulta, todos, visibles, ocultos } = useReportesVisibles();
  useDestinoDeAviso(todos);
  const calor = useMapaDeCalor();
  const zonas = useZonas().lista.data ?? SIN_ZONAS;
  const { desde, conGps } = useOrigen();
  const editandoZona = useEstado((s) => s.zonaEnEdicion !== null);
  const conCalor = useEstado((s) => s.capa === 'calor');

  return (
    <div className="app">
      <Encabezado />
      <main className="app__cuerpo">
        <Mapa
          reportes={visibles}
          calor={{ celdas: calor.celdas, cargando: calor.isFetching, fallo: calor.isError }}
          zonas={zonas}
        >
          {/* El «¿Sigue ahí?» flota sobre el mapa, abajo, sin tapar sus herramientas. */}
          {!editandoZona && !conCalor && <AvisoSigueAhi reportes={todos} />}
        </Mapa>
        {editandoZona ? (
          <Suspense fallback={null}>
            <EditorDeZona />
          </Suspense>
        ) : (
          <PanelCerca
            reportes={visibles}
            ocultos={ocultos}
            desde={desde}
            origen={conGps ? 'gps' : 'mapa'}
            cargando={consulta.isPending}
            fallo={consulta.isError}
            reintentar={() => void consulta.refetch()}
          />
        )}
      </main>
      <Avisos />
      <Hojas reportes={todos} />
    </div>
  );
}
