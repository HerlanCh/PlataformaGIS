import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as conectar } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { adjuntarTiempoReal } from './realtime.js';
import type { TiempoReal } from './realtime.js';

describe('tiempo real', () => {
  let realtime: TiempoReal | undefined;

  afterEach(async () => {
    await realtime?.close();
  });

  it('emite ping periódicamente a un cliente conectado', async () => {
    const servidor = createServer();
    realtime = adjuntarTiempoReal(servidor, {
      origenCors: 'http://localhost:5173',
      intervaloPingMs: 20,
    });
    await new Promise<void>((listo) => servidor.listen(0, listo));
    const { port } = servidor.address() as AddressInfo;

    const cliente = conectar(`http://localhost:${port}`, { transports: ['websocket'] });
    const pings: { secuencia: number; en: string }[] = [];
    await new Promise<void>((listo) => {
      cliente.on('ping', (ping: { secuencia: number; en: string }) => {
        pings.push(ping);
        if (pings.length === 2) listo();
      });
    });
    cliente.close();

    const [primero, segundo] = pings;
    expect(segundo?.secuencia).toBe((primero?.secuencia ?? 0) + 1);
    expect(Number.isNaN(Date.parse(primero?.en ?? ''))).toBe(false);
  });
});
