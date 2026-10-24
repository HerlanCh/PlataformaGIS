// Errores de la aplicación a GlitchTip (roadmap 12). Habla el protocolo de eventos de Sentry, que
// GlitchTip acepta, sin el SDK: no suma dependencias ni peso al JS inicial de la PWA, y todo lo que
// sale pasa por `sinDatosPersonales` (sin ids, coordenadas ni parámetros de URL; RNF-14).
// Lo usan la API (Node) y la PWA (navegador); el envío se inyecta.

/** Dónde se publican los eventos: la URL de "store" con la clave pública en la consulta. */
export interface DestinoDeErrores {
  readonly url: string;
}

/** Lee un DSN `https://<clave>@<host>/<proyecto>`. Lanza si no tiene esa forma. */
export function leerDsn(dsn: string): DestinoDeErrores {
  const url = new URL(dsn);
  const proyecto = url.pathname.replace(/^\/+|\/+$/g, '');
  if (!url.username || !/^\d+$/.test(proyecto)) {
    throw new Error('DSN inválido: se espera https://<clave>@<host>/<proyecto>');
  }
  const consulta = new URLSearchParams({ sentry_key: url.username, sentry_version: '7' });
  return { url: `${url.origin}/api/${proyecto}/store/?${consulta}` };
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/** Un número con 4 o más decimales: una latitud o longitud. */
const COORDENADA = /-?\d{1,3}\.\d{4,}/g;
/** La consulta de una URL, que puede llevar una ventana del mapa o un token. */
const CONSULTA = /\?[^\s)'"]*/g;
const LARGO_MAXIMO = 500;

/** Quita de un texto lo que podría identificar a alguien o ubicarlo (RNF-14). */
export const sinDatosPersonales = (texto: string): string =>
  texto
    .replace(CONSULTA, '')
    .replace(UUID, '<id>')
    .replace(COORDENADA, '<coordenada>')
    .slice(0, LARGO_MAXIMO);

interface Marco {
  readonly function?: string;
  readonly filename: string;
  readonly lineno: number;
  readonly colno: number;
  readonly in_app: boolean;
}

// V8 (Node y Chrome): `at funcion (archivo:1:2)` o `at archivo:1:2`.
const MARCO_V8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/;
// Firefox y Safari: `funcion@archivo:1:2`.
const MARCO_GECKO = /^(.*?)@(.+?):(\d+):(\d+)$/;

function marco(linea: string): Marco | null {
  const partes = MARCO_V8.exec(linea) ?? MARCO_GECKO.exec(linea);
  if (!partes) return null;
  const [, funcion, archivo = '', fila = '0', columna = '0'] = partes;
  const filename = sinDatosPersonales(archivo);
  return {
    ...(funcion ? { function: funcion } : {}),
    filename,
    lineno: Number(fila),
    colno: Number(columna),
    in_app: !filename.includes('node_modules') && !filename.startsWith('node:'),
  };
}

/** Marcos de la pila, del más antiguo al más reciente, como los espera Sentry. */
export const marcosDe = (pila: string | undefined): Marco[] =>
  (pila ?? '')
    .split('\n')
    .map(marco)
    .filter((m): m is Marco => m !== null)
    .reverse();

export interface ContextoDeError {
  /** Patrón de la ruta (`/v1/reportes/:id`) o la pantalla; nunca la URL con sus datos. */
  readonly ruta?: string;
}

export interface ConfigDeReportador {
  readonly dsn: string;
  readonly entorno: string;
  readonly version: string;
  readonly plataforma: 'node' | 'javascript';
  /** Envío del evento ya serializado. Nunca debe lanzar a quien reporta. */
  readonly enviar: (url: string, cuerpo: string) => Promise<unknown>;
  readonly generarId: () => string;
  readonly ahora?: () => Date;
}

export interface ReportadorDeErrores {
  reportar(error: unknown, contexto?: ContextoDeError): void;
}

/** No envía nada: sin DSN configurado, en desarrollo y en las pruebas. */
export const reportadorNulo: ReportadorDeErrores = { reportar: () => undefined };

/** Evento de Sentry (formato "store") de un error, ya sin datos personales. */
export function eventoDeError(
  error: unknown,
  config: Omit<ConfigDeReportador, 'dsn' | 'enviar'>,
  contexto: ContextoDeError = {},
) {
  const comoError = error instanceof Error ? error : new Error(String(error));
  return {
    event_id: config.generarId().replaceAll('-', ''),
    timestamp: (config.ahora?.() ?? new Date()).toISOString(),
    platform: config.plataforma,
    level: 'error',
    environment: config.entorno,
    release: config.version,
    ...(contexto.ruta ? { tags: { ruta: sinDatosPersonales(contexto.ruta) } } : {}),
    exception: {
      values: [
        {
          type: comoError.name,
          value: sinDatosPersonales(comoError.message),
          stacktrace: { frames: marcosDe(comoError.stack) },
        },
      ],
    },
  };
}

/** Reportador que envía cada error a GlitchTip sin esperar ni fallar nunca. */
export function crearReportador(config: ConfigDeReportador): ReportadorDeErrores {
  const destino = leerDsn(config.dsn);
  return {
    reportar(error, contexto) {
      try {
        const cuerpo = JSON.stringify(eventoDeError(error, config, contexto));
        config.enviar(destino.url, cuerpo).catch(() => undefined);
      } catch {
        // Un error al reportar nunca debe tumbar a quien reporta.
      }
    },
  };
}
