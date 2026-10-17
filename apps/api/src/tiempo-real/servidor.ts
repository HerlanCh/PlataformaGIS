import type { Server as HttpServer } from 'node:http';
import { http } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { PuntoGeo } from '@gis/shared-kernel';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { ErrorNoAutenticado } from '../http/errores.js';
import type { ServicioDeTokens } from '../http/tokens.js';
import { salasDePunto, salasDeVentana } from './salas.js';

export interface OpcionesTiempoReal {
  readonly origenCors: string;
  readonly tokens: ServicioDeTokens;
  /** Tiempo durante el cual una reconexión recupera los eventos perdidos. */
  readonly recuperacionMs?: number;
}

export interface TiempoReal {
  readonly io: Server;
  /** Envía el evento a los clientes que miran la celda del punto. */
  difundir(evento: EventoDeIntegracion, punto: PuntoGeo): void;
  close(): Promise<void>;
}

/** Respuesta a `viewport:actualizar`. */
export type RespuestaDeVentana = { ok: true; salas: number } | { ok: false; codigo: string };

/**
 * Servidor Socket.io (RF-05, HU-02 escenario 2). Protocolo:
 * - Conexión con `auth: { token }`: el mismo JWT de la API.
 * - `viewport:actualizar` `{ bbox }` (`lonMin,latMin,lonMax,latMax`): el cliente pasa a escuchar
 *   las celdas que cubren su ventana. Responde con el número de salas o un código de error.
 * - `evento`: evento de integración público, con su `id` para descartar repetidos.
 * - Tras una desconexión breve, Socket.io reenvía lo perdido; tras una larga, el cliente vuelve a
 *   pedir `GET /v1/reportes` de su ventana.
 */
export function adjuntarTiempoReal(servidor: HttpServer, opciones: OpcionesTiempoReal): TiempoReal {
  const io = new Server(servidor, {
    cors: { origin: opciones.origenCors },
    connectionStateRecovery: {
      maxDisconnectionDuration: opciones.recuperacionMs ?? 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  io.use((socket, siguiente) => {
    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== 'string' || token === '') {
      siguiente(new Error('TOKEN_AUSENTE'));
      return;
    }
    opciones.tokens.verificar(token).then(
      (identidad) => {
        // Queda en el socket para las acciones autenticadas que lleguen por tiempo real.
        socket.data.identidad = identidad;
        siguiente();
      },
      (error: unknown) =>
        siguiente(new Error(error instanceof ErrorNoAutenticado ? error.codigo : 'TOKEN_INVALIDO')),
    );
  });

  io.on('connection', (socket) => {
    socket.on('viewport:actualizar', (datos: unknown, responder?: unknown) => {
      const respuesta = actualizarVentana(socket, datos);
      if (typeof responder === 'function') responder(respuesta);
    });
  });

  return {
    io,
    difundir(evento, punto) {
      io.to(salasDePunto(punto)).emit('evento', evento);
    },
    close: () => io.close(),
  };
}

function actualizarVentana(socket: Socket, datos: unknown): RespuestaDeVentana {
  const bbox = http.esquemaBbox.safeParse((datos as { bbox?: unknown } | null)?.bbox);
  if (!bbox.success) return { ok: false, codigo: 'VENTANA_INVALIDA' };
  const salas = salasDeVentana(bbox.data);
  if (salas === null) return { ok: false, codigo: 'VENTANA_DEMASIADO_GRANDE' };

  // Se reemplazan las salas: la propia del socket (su id) no se toca.
  for (const actual of socket.rooms) {
    if (actual !== socket.id) void socket.leave(actual);
  }
  void socket.join(salas);
  return { ok: true, salas: salas.length };
}
