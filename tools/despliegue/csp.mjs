// CSP por entorno (roadmap 12): `apps/web/vercel.json` lleva en `connect-src` la API de staging,
// que el proyecto de Vercel de staging usa tal cual. Antes de construir producción, el pipeline
// cambia ese origen por el de `VITE_API_URL` y agrega el de ingesta de errores si hay DSN.
// Uso: VITE_API_URL=… [VITE_SENTRY_DSN=…] node tools/despliegue/csp.mjs apps/web/vercel.json
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const CABECERA = 'Content-Security-Policy';

/** Cambia en `connect-src` la API (el origen que también se pide por `wss://`) y agrega extras. */
export function cspParaEntorno(csp, { urlApi, otrosOrigenes = [] }) {
  const api = new URL(urlApi);
  return csp
    .split(';')
    .map((directiva) => {
      const [nombre, ...fuentes] = directiva.trim().split(/\s+/);
      if (nombre !== 'connect-src') return directiva.trim();
      const hostsApi = new Set(
        fuentes.filter((f) => f.startsWith('wss://')).map((f) => new URL(f).host),
      );
      const conservadas = fuentes.filter(
        (f) => !/^(https|wss):\/\//.test(f) || !hostsApi.has(new URL(f).host),
      );
      const nuevas = [`${api.protocol}//${api.host}`, `wss://${api.host}`, ...otrosOrigenes];
      return [nombre, ...new Set([...conservadas, ...nuevas])].join(' ');
    })
    .join('; ');
}

/** Origen de ingesta de un DSN de Sentry o GlitchTip (`https://clave@host/proyecto`). */
export const origenDeDsn = (dsn) => new URL(dsn).origin;

/** Devuelve la configuración de Vercel con la CSP de cada regla ajustada al entorno. */
export function configuracionParaEntorno(configuracion, opciones) {
  return {
    ...configuracion,
    headers: configuracion.headers.map((regla) => ({
      ...regla,
      headers: regla.headers.map((cabecera) =>
        cabecera.key === CABECERA
          ? { ...cabecera, value: cspParaEntorno(cabecera.value, opciones) }
          : cabecera,
      ),
    })),
  };
}

async function principal() {
  const [archivo] = process.argv.slice(2);
  const urlApi = process.env.VITE_API_URL;
  if (!archivo || !urlApi) {
    console.error('Uso: VITE_API_URL=… node tools/despliegue/csp.mjs <vercel.json>');
    process.exit(2);
  }
  const dsn = process.env.VITE_SENTRY_DSN;
  const opciones = { urlApi, otrosOrigenes: dsn ? [origenDeDsn(dsn)] : [] };
  const configuracion = JSON.parse(await readFile(archivo, 'utf8'));
  const ajustada = configuracionParaEntorno(configuracion, opciones);
  await writeFile(archivo, `${JSON.stringify(ajustada, null, 2)}\n`);
  for (const regla of ajustada.headers) {
    const csp = regla.headers.find((cabecera) => cabecera.key === CABECERA);
    if (csp) console.log(csp.value.split('; ').find((d) => d.startsWith('connect-src')));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await principal();
