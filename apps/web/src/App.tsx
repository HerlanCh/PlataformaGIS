import { useEffect, useMemo } from 'react';
import { URL_API } from './configuracion.js';
import { filtrarReportes } from './domain/filtros.js';
import type { ReportePublico } from './domain/reportes.js';
import { useEstado } from './estado.js';
import { useMapaDeCalor } from './features/calor/usarMapaDeCalor.js';
import { PanelCerca } from './features/cerca/PanelCerca.js';
import { useOrigen } from './features/cerca/usarOrigen.js';
import { HojaDeFiltros } from './features/filtros/HojaDeFiltros.js';
import { Mapa } from './features/mapa/Mapa.js';
import { useReportesEnVentana, useTiempoReal } from './features/mapa/usarReportes.js';
import { HojaDeCategorias } from './features/reporte/HojaDeCategorias.js';
import { useEnviarCola, useReportar } from './features/reporte/usarReportar.js';
import { AvisoSigueAhi } from './features/votos/AvisoSigueAhi.js';
import { HojaDeDetalle } from './features/votos/HojaDeDetalle.js';
import { useSeguirPosicion } from './features/votos/usarSigueAhi.js';
import { EditorDeZona } from './features/zonas/EditorDeZona.js';
import { HojaDeZonas } from './features/zonas/HojaDeZonas.js';
import { useZonas } from './features/zonas/usarZonas.js';
import type { Zona } from './features/zonas/usarZonas.js';
import { pendientes } from './services/cola.js';
import { obtenerToken } from './services/sesion.js';
import { Avisos } from './ui/Avisos.js';
import { Encabezado } from './ui/Encabezado.js';

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
  const reportar = useReportar();
  const { consulta, todos, visibles, ocultos } = useReportesVisibles();
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
          <EditorDeZona />
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
      <HojaDeCategorias alElegir={(codigo) => void reportar(codigo)} />
      <HojaDeDetalle reportes={todos} />
      <HojaDeFiltros />
      <HojaDeZonas />
    </div>
  );
}
