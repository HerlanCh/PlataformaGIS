// Prueba de reinicio con reportes en vuelo (Fase 11, prueba 3.2: 0 eventos perdidos):
// `pnpm fiabilidad:reinicio`. Requiere `pnpm --filter @gis/api build` y una base local.
//   1. Levanta la API compilada y lanza una ráfaga de reportes.
//   2. A mitad de la ráfaga mata el proceso de golpe, como una caída real.
//   3. La vuelve a levantar y reenvía todo con la misma clave de idempotencia, como la cola de la
//      PWA con lo que quedó sin respuesta.
//   4. Comprueba en la base que ningún reporte se perdió ni se duplicó, que cada reenvío devolvió
//      el mismo reporte y que cada `ReporteCreado` del outbox quedó publicado.
// Variables: REPORTES (60 por defecto), MATAR_TRAS (15 respuestas) y PUERTO (3001).
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crearPool } from '@gis/platform';
import { urlDeBaseLocal } from './base-local.js';
import { evaluarReinicio } from './fiabilidad.js';
import type { EstadoEnBase, Envio } from './fiabilidad.js';

const REPORTES = Number(process.env.REPORTES ?? 60);
const PUERTO = Number(process.env.PUERTO ?? 3001);
const BASE_URL = `http://localhost:${PUERTO}`;
// Cada usuario puede crear 5 reportes cada 10 minutos.
const REPORTES_POR_USUARIO = 3;
const MATAR_TRAS = Number(process.env.MATAR_TRAS ?? 15);
const PREFIJO = 'reinicio-';

const dormir = (ms: number) => new Promise((listo) => setTimeout(listo, ms));
const pool = crearPool(urlDeBaseLocal(process.env.DATABASE_URL, 'La prueba de reinicio'));
const directorioApi = fileURLToPath(new URL('../..', import.meta.url));
if (!existsSync(`${directorioApi}/dist/main.js`)) {
  throw new Error('Falta dist/main.js: ejecuta antes `pnpm --filter @gis/api build`');
}

function levantarApi(): ChildProcess {
  return spawn(process.execPath, ['dist/main.js'], {
    cwd: directorioApi,
    env: { ...process.env, PORT: String(PUERTO), LOG_LEVEL: 'warn' },
    stdio: 'ignore',
  });
}

async function esperarSalud(): Promise<void> {
  for (let intento = 0; intento < 100; intento += 1) {
    try {
      if ((await fetch(`${BASE_URL}/health`)).ok) return;
    } catch {
      // Todavía no escucha.
    }
    await dormir(200);
  }
  throw new Error('la API no respondió /health a tiempo');
}

async function registrar(i: number, marca: number): Promise<string> {
  const respuesta = await fetch(`${BASE_URL}/v1/dispositivos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hashDispositivo: `${PREFIJO}${marca}-${i}` }),
  });
  return ((await respuesta.json()) as { token: string }).token;
}

interface Solicitud {
  readonly clave: string;
  readonly token: string;
  readonly cuerpo: { codigoCategoria: string; latitud: number; longitud: number };
}

type Respuesta = Pick<Envio, 'resultado' | 'idReporte'>;

/** `null` si la conexión se cortó o la API no respondió con éxito. */
async function enviar({ clave, token, cuerpo }: Solicitud): Promise<Respuesta | null> {
  try {
    const respuesta = await fetch(`${BASE_URL}/v1/reportes`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'idempotency-key': clave,
      },
      body: JSON.stringify(cuerpo),
    });
    if (!respuesta.ok) return null;
    const { resultado, reporte } = (await respuesta.json()) as {
      resultado: Envio['resultado'];
      reporte: { id: string };
    };
    return { resultado, idReporte: reporte.id };
  } catch {
    return null;
  }
}

/** Puntos en una cuadrícula de unos 1,1 km: no se toman como duplicados entre sí. */
const punto = (i: number) => ({
  latitud: -16.56 + 0.01 * (i % 10),
  longitud: -68.2 + 0.01 * Math.floor(i / 10),
});

async function estadoEnBase(claves: readonly string[]): Promise<Map<string, EstadoEnBase>> {
  const { rows } = await pool.query<{
    clave: string;
    filas: number;
    eventos: number;
    publicados: number;
  }>(
    `select r.clave_idempotencia as clave,
            count(distinct r.id)::int as filas,
            count(e.id)::int as eventos,
            count(e.publicado_en)::int as publicados
       from reportes r
       left join eventos_salida e
         on e.tipo = 'ReporteCreado.v1' and e.contenido->'contenido'->>'idReporte' = r.id::text
      where r.clave_idempotencia = any($1)
      group by r.clave_idempotencia`,
    [claves],
  );
  return new Map(rows.map(({ clave, ...estado }) => [clave, estado]));
}

async function esperarOutboxVacio(): Promise<void> {
  for (let intento = 0; intento < 60; intento += 1) {
    const { rows } = await pool.query<{ pendientes: number }>(
      `select count(*)::int as pendientes from eventos_salida
        where publicado_en is null and contenido->'contenido'->>'idReporte' in
          (select id::text from reportes where clave_idempotencia like $1)`,
      [`${PREFIJO}%`],
    );
    if (rows[0]!.pendientes === 0) return;
    await dormir(500);
  }
}

// Una ejecución anterior dejaría reportes vigentes en los mismos puntos.
await pool.query('delete from reportes where clave_idempotencia like $1', [`${PREFIJO}%`]);

let api = levantarApi();
await esperarSalud();
const marca = Date.now();
const usuarios = Math.ceil(REPORTES / REPORTES_POR_USUARIO);
const tokens = await Promise.all(Array.from({ length: usuarios }, (_, i) => registrar(i, marca)));
const solicitudes: Solicitud[] = Array.from({ length: REPORTES }, (_, i) => ({
  clave: `${PREFIJO}${marca}-${i}`,
  token: tokens[Math.floor(i / REPORTES_POR_USUARIO)]!,
  cuerpo: { codigoCategoria: 'accidente', ...punto(i) },
}));

// La ráfaga: todos los envíos a la vez. Al llegar la respuesta número MATAR_TRAS, la API muere
// sin apagado ordenado, con solicitudes a medio procesar (el pool atiende 5 a la vez).
const victima = api;
let recibidas = 0;
const primeros = solicitudes.map(async (solicitud) => {
  const respuesta = await enviar(solicitud);
  recibidas += 1;
  if (recibidas === MATAR_TRAS) victima.kill('SIGKILL');
  return respuesta;
});
const respuestas = await Promise.all(primeros);
const sinRespuesta = solicitudes.filter((_, i) => respuestas[i] === null);
console.log(`respondidos antes de la caída: ${REPORTES - sinRespuesta.length} de ${REPORTES}`);

// Qué se guardó aunque el cliente no recibió la respuesta.
const guardadas = new Set((await estadoEnBase(sinRespuesta.map((s) => s.clave))).keys());

api = levantarApi();
await esperarSalud();
// Se reenvían todas, también las respondidas: así se comporta un cliente que no llegó a ver la
// respuesta. La API debe devolver el mismo reporte sin crear otro.
const envios: Envio[] = [];
for (const [i, solicitud] of solicitudes.entries()) {
  const primera = respuestas[i] ?? null;
  const reenvio = await enviar(solicitud);
  const final = primera ?? reenvio;
  envios.push({
    clave: solicitud.clave,
    resultado: final?.resultado ?? null,
    idReporte: final?.idReporte ?? null,
    reintentado: primera === null,
    reenvioCoincide: reenvio !== null && reenvio.idReporte === final?.idReporte,
  });
}
await esperarOutboxVacio();

const resumen = evaluarReinicio(
  envios,
  await estadoEnBase(solicitudes.map((s) => s.clave)),
  guardadas,
);
api.kill();
await pool.end();
console.log(JSON.stringify({ fecha: new Date().toISOString(), ...resumen }, null, 2));
console.log(resumen.cumple ? 'CUMPLE' : 'NO CUMPLE');
process.exit(resumen.cumple ? 0 : 1);
