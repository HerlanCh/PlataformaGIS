import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as conectar } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { attachRealtime } from './realtime.js';
import type { Realtime } from './realtime.js';

describe('tiempo real', () => {
  let realtime: Realtime | undefined;

  afterEach(async () => {
    await realtime?.close();
  });

  it('emite ping periódicamente a un cliente conectado', async () => {
    const servidor = createServer();
    realtime = attachRealtime(servidor, {
      corsOrigin: 'http://localhost:5173',
      pingIntervalMs: 20,
    });
    await new Promise<void>((listo) => servidor.listen(0, listo));
    const { port } = servidor.address() as AddressInfo;

    const cliente = conectar(`http://localhost:${port}`, { transports: ['websocket'] });
    const pings: { seq: number; at: string }[] = [];
    await new Promise<void>((listo) => {
      cliente.on('ping', (ping: { seq: number; at: string }) => {
        pings.push(ping);
        if (pings.length === 2) listo();
      });
    });
    cliente.close();

    const [primero, segundo] = pings;
    expect(segundo?.seq).toBe((primero?.seq ?? 0) + 1);
    expect(Number.isNaN(Date.parse(primero?.at ?? ''))).toBe(false);
  });
});
