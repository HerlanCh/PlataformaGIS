import { useEffect } from 'react';
import { URL_API } from './configuracion.js';
import { CENTRO_LA_PAZ } from './domain/geo.js';
import { useEstado } from './estado.js';
import { PanelCerca } from './features/cerca/PanelCerca.js';
import { Mapa } from './features/mapa/Mapa.js';
import { useReportesEnVentana, useTiempoReal } from './features/mapa/usarReportes.js';
import { HojaDeCategorias } from './features/reporte/HojaDeCategorias.js';
import { useEnviarCola, useReportar } from './features/reporte/usarReportar.js';
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

/** Pantalla principal: mapa en vivo, lo que pasa cerca y el reporte en dos toques. */
export function App() {
  usePuestaEnMarcha();
  useTiempoReal();
  const reportar = useReportar();
  const consulta = useReportesEnVentana();
  const posicion = useEstado((s) => s.posicion);
  const ventana = useEstado((s) => s.ventana);
  const reportes = consulta.data ?? [];
  const desde =
    posicion ??
    (ventana
      ? {
          latitud: (ventana.latitudMin + ventana.latitudMax) / 2,
          longitud: (ventana.longitudMin + ventana.longitudMax) / 2,
        }
      : CENTRO_LA_PAZ);

  return (
    <div className="app">
      <Encabezado />
      <main className="app__cuerpo">
        <Mapa reportes={reportes} />
        <PanelCerca
          reportes={reportes}
          desde={desde}
          origen={posicion ? 'gps' : 'mapa'}
          cargando={consulta.isPending}
          fallo={consulta.isError}
          reintentar={() => void consulta.refetch()}
        />
      </main>
      <Avisos />
      <HojaDeCategorias alElegir={(codigo) => void reportar(codigo)} />
    </div>
  );
}
