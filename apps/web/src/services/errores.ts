// Errores de la PWA a GlitchTip (roadmap 12): los que nadie atrapó y las promesas rechazadas sin
// manejar. Solo se activa si la versión se construyó con VITE_SENTRY_DSN (producción). La ruta es
// el `pathname`, sin la consulta; el resto lo limpia `@gis/errores-remotos`.
import { crearReportador } from '@gis/errores-remotos';

interface OpcionesDeErrores {
  readonly dsn: string | undefined;
  readonly version: string;
  readonly entorno: string;
  /** Cuerpo como texto plano: GlitchTip lo acepta y el navegador no hace una consulta CORS previa. */
  readonly enviar?: (url: string, cuerpo: string) => Promise<unknown>;
}

const enviarConFetch = (url: string, cuerpo: string) =>
  fetch(url, { method: 'POST', body: cuerpo, keepalive: true });

/** Escucha los errores de la ventana y los envía. Devuelve si quedó activo. */
export function reportarErroresDeLaVentana(
  ventana: Pick<Window, 'addEventListener' | 'location'>,
  { dsn, version, entorno, enviar = enviarConFetch }: OpcionesDeErrores,
): boolean {
  if (!dsn) return false;
  const reportador = crearReportador({
    dsn,
    version,
    entorno,
    plataforma: 'javascript',
    enviar,
    generarId: () => crypto.randomUUID(),
  });
  const ruta = () => ventana.location.pathname;
  ventana.addEventListener('error', (evento) => {
    reportador.reportar(evento.error ?? evento.message, { ruta: ruta() });
  });
  ventana.addEventListener('unhandledrejection', (evento) => {
    reportador.reportar(evento.reason, { ruta: ruta() });
  });
  return true;
}
