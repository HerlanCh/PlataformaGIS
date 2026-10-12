import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';

export interface OpcionesTiempoReal {
  readonly origenCors: string;
  readonly intervaloPingMs?: number;
}

export interface TiempoReal {
  readonly io: Server;
  close(): Promise<void>;
}

/** Servidor Socket.io mínimo: emite `ping` periódicamente a todos los clientes. */
export function adjuntarTiempoReal(servidor: HttpServer, opciones: OpcionesTiempoReal): TiempoReal {
  const io = new Server(servidor, { cors: { origin: opciones.origenCors } });

  let secuencia = 0;
  const temporizador = setInterval(() => {
    secuencia += 1;
    io.emit('ping', { secuencia, en: new Date().toISOString() });
  }, opciones.intervaloPingMs ?? 5000);

  return {
    io,
    close: async () => {
      clearInterval(temporizador);
      await io.close();
    },
  };
}
