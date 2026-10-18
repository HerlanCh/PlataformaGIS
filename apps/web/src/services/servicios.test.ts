import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reiniciarAlmacen } from './almacen.js';
import { encolar, enviarPendientes, pendientes } from './cola.js';
import { idUsuarioActual, obtenerToken } from './sesion.js';

const API = 'http://api.test';
const USUARIO = '11111111-1111-4111-8111-111111111111';

const json = (cuerpo: unknown, status = 200, cabeceras: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json', ...cabeceras },
  });

const credencial = (token = 'tok-1', horas = 24) =>
  json({
    idUsuario: USUARIO,
    rol: 'CIUDADANO',
    esNuevo: true,
    token,
    expiraEn: new Date(Date.now() + horas * 3_600_000).toISOString(),
  });

/** Servidor falso: registra dispositivos y responde a /v1/reportes con la respuesta indicada. */
function servidor(alReportar: (cuerpo: Request) => Response | Promise<Response>) {
  const pedidos: Request[] = [];
  const pedir = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const solicitud = new Request(entrada, init);
    pedidos.push(solicitud);
    if (solicitud.url.endsWith('/v1/dispositivos')) return credencial(`tok-${pedidos.length}`);
    return alReportar(solicitud);
  }) as unknown as typeof fetch;
  return { pedir, pedidos };
}

const creado = (resultado = 'CREADO') =>
  json({ resultado, reporte: { id: 'r1' } }, resultado === 'CREADO' ? 201 : 200);

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarAlmacen();
});

describe('sesión del dispositivo (RF-01)', () => {
  it('registra un hash anónimo una vez y reutiliza el token mientras está vigente', async () => {
    const { pedir, pedidos } = servidor(() => creado());

    const primero = await obtenerToken(API, { fetch: pedir });
    const segundo = await obtenerToken(API, { fetch: pedir });

    expect(primero).toBe(segundo);
    expect(pedidos).toHaveLength(1);
    const cuerpo = (await pedidos[0]!.json()) as { hashDispositivo: string };
    expect(cuerpo.hashDispositivo).toMatch(/^web-[0-9a-f]{32}$/);
    expect(await idUsuarioActual()).toBe(USUARIO);
  });

  it('renueva el token con el mismo hash si se fuerza', async () => {
    const { pedir, pedidos } = servidor(() => creado());
    await obtenerToken(API, { fetch: pedir });

    await obtenerToken(API, { fetch: pedir, forzar: true });

    const [a, b] = await Promise.all(
      pedidos.map((p) => p.json() as Promise<{ hashDispositivo: string }>),
    );
    expect(a!.hashDispositivo).toBe(b!.hashDispositivo);
  });

  it('varias llamadas simultáneas comparten un solo registro', async () => {
    const { pedir, pedidos } = servidor(() => creado());

    const tokens = await Promise.all([1, 2, 3, 4].map(() => obtenerToken(API, { fetch: pedir })));

    expect(new Set(tokens).size).toBe(1);
    expect(pedidos).toHaveLength(1);
  });

  it('un registro rechazado es un error con su estado', async () => {
    const pedir = vi.fn(async () => json({}, 503)) as unknown as typeof fetch;

    await expect(obtenerToken(API, { fetch: pedir })).rejects.toMatchObject({ status: 503 });
  });
});

describe('cola sin conexión (HU-05)', () => {
  const bloqueo = { codigoCategoria: 'bloqueo', latitud: -16.5, longitud: -68.15 };

  it('HU-05: envía con la clave de idempotencia y saca de la cola lo que la API aceptó', async () => {
    const { pedir, pedidos } = servidor(() => creado());
    const pendiente = await encolar(bloqueo);

    const [envio] = await enviarPendientes(API, pedir);

    expect(envio?.resultado).toEqual({ tipo: 'CREADO', idReporte: 'r1' });
    const reporte = pedidos.find((p) => p.url.endsWith('/v1/reportes'))!;
    expect(reporte.headers.get('idempotency-key')).toBe(pendiente.clave);
    expect(reporte.headers.get('authorization')).toMatch(/^Bearer tok-/);
    expect(await pendientes()).toEqual([]);
  });

  it('HU-05: sin red el reporte queda pendiente y no se pierde', async () => {
    const pedir = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await encolar(bloqueo);
    await encolar({ ...bloqueo, codigoCategoria: 'robo' });

    const resultados = await enviarPendientes(API, pedir);

    expect(resultados).toHaveLength(1);
    expect(resultados[0]?.resultado).toEqual({ tipo: 'PENDIENTE' });
    const quedan = await pendientes();
    expect(quedan.map((p) => [p.codigoCategoria, p.intentos])).toEqual([
      ['bloqueo', 1],
      ['robo', 0],
    ]);
  });

  it('HU-05: al volver la señal se envían todos, en orden, exactamente una vez', async () => {
    const { pedir, pedidos } = servidor(() => creado());
    for (const codigo of ['bloqueo', 'accidente', 'robo'])
      await encolar({ ...bloqueo, codigoCategoria: codigo });

    const resultados = await enviarPendientes(API, pedir);

    expect(resultados.map((r) => r.pendiente.codigoCategoria)).toEqual([
      'bloqueo',
      'accidente',
      'robo',
    ]);
    expect(pedidos.filter((p) => p.url.endsWith('/v1/reportes'))).toHaveLength(3);
    expect(await pendientes()).toEqual([]);
  });

  it('un 5xx deja el reporte pendiente', async () => {
    const { pedir } = servidor(() => json({}, 503));
    await encolar(bloqueo);

    expect((await enviarPendientes(API, pedir))[0]?.resultado.tipo).toBe('PENDIENTE');
    expect(await pendientes()).toHaveLength(1);
  });

  it('HU-01: un rechazo (fuera del área, límite) se informa con su código y sale de la cola', async () => {
    const { pedir } = servidor(() =>
      json({ codigo: 'LIMITE_EXCEDIDO', status: 429 }, 429, { 'retry-after': '120' }),
    );
    await encolar(bloqueo);

    const [envio] = await enviarPendientes(API, pedir);

    expect(envio?.resultado).toEqual({
      tipo: 'RECHAZADO',
      codigo: 'LIMITE_EXCEDIDO',
      reintentarEnS: 120,
    });
    expect(await pendientes()).toEqual([]);
  });

  it('un rechazo sin cuerpo legible usa el código HTTP', async () => {
    const { pedir } = servidor(() => new Response('x', { status: 400 }));
    await encolar(bloqueo);

    expect((await enviarPendientes(API, pedir))[0]?.resultado).toEqual({
      tipo: 'RECHAZADO',
      codigo: 'HTTP_400',
      reintentarEnS: null,
    });
  });

  it('con el token vencido lo renueva una vez y reintenta', async () => {
    let llamadas = 0;
    const { pedir, pedidos } = servidor(() =>
      ++llamadas === 1 ? json({ codigo: 'TOKEN_VENCIDO' }, 401) : creado('DUPLICADO'),
    );
    await encolar(bloqueo);

    const [envio] = await enviarPendientes(API, pedir);

    expect(envio?.resultado).toEqual({ tipo: 'DUPLICADO', idReporte: 'r1' });
    expect(pedidos.filter((p) => p.url.endsWith('/v1/dispositivos'))).toHaveLength(2);
  });

  it('dos envíos simultáneos comparten el mismo trabajo', async () => {
    const { pedir, pedidos } = servidor(() => creado());
    await encolar(bloqueo);

    const [a, b] = await Promise.all([enviarPendientes(API, pedir), enviarPendientes(API, pedir)]);

    expect(a).toBe(b);
    expect(pedidos.filter((p) => p.url.endsWith('/v1/reportes'))).toHaveLength(1);
  });
});
