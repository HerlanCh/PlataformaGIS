import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';

export interface RealtimeOptions {
  readonly corsOrigin: string;
  readonly pingIntervalMs?: number;
}

export interface Realtime {
  readonly io: Server;
  close(): Promise<void>;
}

/** Servidor Socket.io mínimo: emite `ping` periódicamente a todos los clientes. */
export function attachRealtime(server: HttpServer, options: RealtimeOptions): Realtime {
  const io = new Server(server, { cors: { origin: options.corsOrigin } });

  let seq = 0;
  const temporizador = setInterval(() => {
    seq += 1;
    io.emit('ping', { seq, at: new Date().toISOString() });
  }, options.pingIntervalMs ?? 5000);

  return {
    io,
    close: async () => {
      clearInterval(temporizador);
      await io.close();
    },
  };
}
