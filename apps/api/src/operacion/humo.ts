// Prueba de humo contra una API desplegada (roadmap 12): `pnpm humo`.
// Variables: BASE_URL (API), HUMO_HASH_DISPOSITIVO (secreto del usuario de humo) y, opcional,
// VERSION_ESPERADA (commit que debe servir /health). La lógica está en `prueba-de-humo.ts`.
import type { EventoDeIntegracion } from '@gis/contracts';
import { io as conectar } from 'socket.io-client';
import { ejecutarPruebaDeHumo, FalloDeHumo } from './prueba-de-humo.js';
import type { ClienteDeHumo, Escucha } from './prueba-de-humo.js';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const hashDispositivo = process.env.HUMO_HASH_DISPOSITIVO;
if (!hashDispositivo) {
  console.error('Uso: BASE_URL=… HUMO_HASH_DISPOSITIVO=… [VERSION_ESPERADA=…] pnpm humo');
  process.exit(2);
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, opciones);
  if (!respuesta.ok) throw new Error(`${ruta}: ${respuesta.status} ${await respuesta.text()}`);
  return (respuesta.status === 202 ? undefined : await respuesta.json()) as T;
}

const enviar = (cuerpo: unknown, token?: string, cabeceras: Record<string, string> = {}) => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...cabeceras,
  },
  body: JSON.stringify(cuerpo),
});

async function escuchar(token: string, bbox: string): Promise<Escucha> {
  const recibidos = new Set<string>();
  const socket = conectar(BASE_URL, { transports: ['websocket'], auth: { token } });
  socket.on('evento', (evento: EventoDeIntegracion) => {
    if (evento.tipo === 'ReporteCreado') {
      recibidos.add((evento.contenido as { idReporte: string }).idReporte);
    }
  });
  await new Promise<void>((listo, fallo) => {
    socket.once('connect', listo);
    socket.once('connect_error', fallo);
  });
  const respuesta = await socket.emitWithAck('viewport:actualizar', { bbox });
  if (!respuesta.ok) throw new Error(`ventana rechazada: ${respuesta.codigo}`);
  return {
    async recibio(idReporte, plazoMs) {
      for (let esperado = 0; esperado <= plazoMs; esperado += 100) {
        if (recibidos.has(idReporte)) return true;
        await new Promise((listo) => setTimeout(listo, 100));
      }
      return false;
    },
    cerrar: () => void socket.close(),
  };
}

const cliente: ClienteDeHumo = {
  salud: () => pedir('/health'),
  registrar: (hash) => pedir('/v1/dispositivos', enviar({ hashDispositivo: hash })),
  escuchar,
  async crearReporte(token, punto, clave) {
    const { resultado, reporte } = await pedir<{ resultado: string; reporte: { id: string } }>(
      '/v1/reportes',
      enviar({ codigoCategoria: 'infraestructura', ...punto }, token, { 'idempotency-key': clave }),
    );
    return { resultado, idReporte: reporte.id };
  },
  async listar(bbox) {
    const { reportes } = await pedir<{ reportes: { id: string }[] }>(
      `/v1/reportes?bbox=${encodeURIComponent(bbox)}`,
    );
    return reportes.map((r) => r.id);
  },
  rechazar: (token, id, motivo) =>
    pedir(`/v1/moderacion/reportes/${id}/rechazar`, enviar({ motivo }, token)),
};

try {
  const pasos = await ejecutarPruebaDeHumo(cliente, {
    hashDispositivo,
    versionEsperada: process.env.VERSION_ESPERADA || undefined,
    marca: String(Date.now()),
  });
  for (const paso of pasos) console.log(`✔ ${paso}`);
  console.log(`Prueba de humo superada contra ${BASE_URL}`);
  process.exit(0);
} catch (error) {
  console.error(`✘ ${error instanceof FalloDeHumo ? error.message : String(error)}`);
  process.exit(1);
}
