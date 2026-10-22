// Prueba de difusión (Fase 7, RNF-10: p95 < 2 s con 500 clientes): `pnpm carga:difusion`.
// Conecta CLIENTES sockets repartidos en ZONAS de la ciudad, crea reportes por HTTP y mide el
// tiempo entre el envío del POST y la llegada del evento a los clientes de su zona. Comprueba que
// ningún cliente de otra zona lo reciba. Variables: BASE_URL, CLIENTES, REPORTES.
import { randomInt } from 'node:crypto';
import type { EventoDeIntegracion } from '@gis/contracts';
import { io as conectar } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { percentil } from './estadisticas.js';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CLIENTES = Number(process.env.CLIENTES ?? 500);
const REPORTES = Number(process.env.REPORTES ?? 20);
const ZONAS = 10;
const INTENTOS_POR_REPORTE = 5;
// Cada intento usa otro usuario: con la ciudad densa (la carga de 100.000 reportes) muchos puntos
// caen como duplicados, y ningún usuario debe pasar de su límite de 5 reportes cada 10 minutos.
const USUARIOS = Math.max(10, Math.ceil((REPORTES * INTENTOS_POR_REPORTE) / 5));
const PAUSA_ENTRE_REPORTES_MS = 3000;
const ESPERA_FINAL_MS = 5000;

const dormir = (ms: number) => new Promise((listo) => setTimeout(listo, ms));
/** Desplazamiento al azar de hasta ±0,003° (unos ±330 m). */
const desvio = () => (randomInt(-3000, 3001) / 1000) * 0.001;

/** Zonas separadas unos 3 km, en celdas distintas: cada una tiene su propio público. */
const zonas = Array.from({ length: ZONAS }, (_, i) => ({
  latitud: -16.6 + 0.03 * (i % 5),
  longitud: -68.24 + 0.08 * Math.floor(i / 5),
}));
const bbox = ({ latitud, longitud }: { latitud: number; longitud: number }) =>
  [longitud - 0.004, latitud - 0.004, longitud + 0.004, latitud + 0.004]
    .map((n) => n.toFixed(5))
    .join(',');

async function pedir<T>(
  ruta: string,
  cuerpo: unknown,
  cabeceras: Record<string, string> = {},
): Promise<T> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...cabeceras },
    body: JSON.stringify(cuerpo),
  });
  if (!respuesta.ok) throw new Error(`${ruta}: ${respuesta.status} ${await respuesta.text()}`);
  return (await respuesta.json()) as T;
}

interface Oyente {
  readonly zona: number;
  readonly socket: Socket;
}

const recepciones = new Map<string, { zona: number; en: number }[]>();

async function conectarCliente(zona: number, token: string): Promise<Oyente> {
  const socket = conectar(BASE_URL, { transports: ['websocket'], auth: { token } });
  socket.on('evento', (evento: EventoDeIntegracion) => {
    const id = (evento.contenido as { idReporte: string }).idReporte;
    if (evento.tipo !== 'ReporteCreado') return;
    const lista = recepciones.get(id) ?? [];
    lista.push({ zona, en: performance.now() });
    recepciones.set(id, lista);
  });
  await new Promise<void>((listo, fallo) => {
    socket.once('connect', listo);
    socket.once('connect_error', fallo);
  });
  const respuesta = await socket.emitWithAck('viewport:actualizar', { bbox: bbox(zonas[zona]!) });
  if (!respuesta.ok) throw new Error(`ventana rechazada: ${respuesta.codigo}`);
  return { zona, socket };
}

const marca = Date.now();
const tokens: string[] = [];
for (let i = 0; i < USUARIOS; i += 1) {
  const { token } = await pedir<{ token: string }>('/v1/dispositivos', {
    hashDispositivo: `difusion-${marca}-${i}`,
  });
  tokens.push(token);
}

const oyentes: Oyente[] = [];
for (let inicio = 0; inicio < CLIENTES; inicio += 25) {
  const tanda = Array.from({ length: Math.min(25, CLIENTES - inicio) }, (_, j) => {
    const n = inicio + j;
    return conectarCliente(n % ZONAS, tokens[n % USUARIOS]!);
  });
  oyentes.push(...(await Promise.all(tanda)));
}
console.log(`clientes conectados: ${oyentes.length}`);

/**
 * Crea un reporte en un punto al azar de la zona (dentro de la ventana de sus clientes). Si cae
 * junto a otro vigente, la API lo toma como duplicado y no emite ReporteCreado: se prueba otro punto.
 */
async function crearReporte(zona: number, r: number) {
  for (let intento = 0; intento < INTENTOS_POR_REPORTE; intento += 1) {
    const token = tokens[(r * INTENTOS_POR_REPORTE + intento) % USUARIOS]!;
    const centro = zonas[zona]!;
    const punto = {
      latitud: centro.latitud + desvio(),
      longitud: centro.longitud + desvio(),
    };
    const en = performance.now();
    const { resultado, reporte } = await pedir<{ resultado: string; reporte: { id: string } }>(
      '/v1/reportes',
      { codigoCategoria: 'accidente', ...punto },
      { authorization: `Bearer ${token}`, 'idempotency-key': `difusion-${marca}-${r}-${intento}` },
    );
    if (resultado === 'CREADO') return { id: reporte.id, en };
  }
  console.warn(`reporte ${r}: sin lugar libre en la zona ${zona}`);
  return null;
}

const enviados: { id: string; zona: number; en: number }[] = [];
for (let r = 0; r < REPORTES; r += 1) {
  const zona = r % ZONAS;
  const envio = await crearReporte(zona, r);
  if (envio) enviados.push({ ...envio, zona });
  await dormir(PAUSA_ENTRE_REPORTES_MS);
}
await dormir(ESPERA_FINAL_MS);

const latencias: number[] = [];
let esperadas = 0;
let ajenas = 0;
for (const envio of enviados) {
  esperadas += oyentes.filter((o) => o.zona === envio.zona).length;
  for (const recepcion of recepciones.get(envio.id) ?? []) {
    if (recepcion.zona === envio.zona) latencias.push(recepcion.en - envio.en);
    else ajenas += 1;
  }
}
for (const oyente of oyentes) oyente.socket.close();

const ordenadas = [...latencias].sort((a, b) => a - b);
const ms = (porcentaje: number) =>
  ordenadas.length === 0 ? Number.POSITIVE_INFINITY : Math.round(percentil(ordenadas, porcentaje));
const resumen = {
  fecha: new Date().toISOString(),
  baseUrl: BASE_URL,
  clientes: oyentes.length,
  reportes: enviados.length,
  entregasEsperadas: esperadas,
  entregasRecibidas: latencias.length,
  entregasAOtrasZonas: ajenas,
  p50Ms: ms(50),
  p95Ms: ms(95),
  maximoMs: Math.round(ordenadas.at(-1) ?? 0),
};
console.log(JSON.stringify(resumen, null, 2));
const cumple = resumen.p95Ms < 2000 && latencias.length === esperadas && ajenas === 0;
console.log(cumple ? 'CUMPLE' : 'NO CUMPLE');
process.exit(cumple ? 0 : 1);
