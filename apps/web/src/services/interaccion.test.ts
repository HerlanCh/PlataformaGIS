import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirAlmacen, reiniciarAlmacen } from './almacen.js';
import { encolar, enviarPendientes } from './cola.js';
import { leerMemoria, recordar } from './memoria.js';
import { votar } from './votos.js';
import { crearZona, eliminarZona, ErrorDeZona, listarZonas } from './zonas.js';

const API = 'http://api.test';
const REPORTE = '33333333-3333-4333-8333-333333333333';
const AQUI = { latitud: -16.4955, longitud: -68.1336 };

const json = (cuerpo: unknown, status = 200, cabeceras: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json', ...cabeceras },
  });

/** Servidor falso: registra dispositivos y responde lo indicado al resto de rutas. */
function servidor(responder: (solicitud: Request) => Response | Promise<Response>) {
  const pedidos: Request[] = [];
  const pedir = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const solicitud = new Request(entrada, init);
    pedidos.push(solicitud);
    if (solicitud.url.endsWith('/v1/dispositivos')) {
      return json({
        idUsuario: '11111111-1111-4111-8111-111111111111',
        token: 'tok',
        expiraEn: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    return responder(solicitud);
  }) as unknown as typeof fetch;
  return { pedir, pedidos };
}

const sinRed = vi.fn(async () => {
  throw new TypeError('Failed to fetch');
}) as unknown as typeof fetch;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarAlmacen();
});

describe('almacén local', () => {
  it('pasa de la versión 1 a la 2 sin perder la sesión ni la cola', async () => {
    const v1 = await openDB('alerta-lp', 1, {
      upgrade(db) {
        db.createObjectStore('sesion');
        db.createObjectStore('cola', { keyPath: 'clave' }).createIndex('orden', 'orden');
      },
    });
    await v1.put('sesion', { hashDispositivo: 'web-abc' }, 'actual');
    v1.close();

    const db = await abrirAlmacen();

    expect(db.version).toBe(2);
    expect(await db.get('sesion', 'actual')).toMatchObject({ hashDispositivo: 'web-abc' });
    expect(db.objectStoreNames.contains('memoria')).toBe(true);
  });

  it('la memoria suma datos al recuerdo de un reporte sin borrar los anteriores', async () => {
    await recordar(REPORTE, { preguntado: true });
    await recordar(REPORTE, { voto: 'NEGACION' });

    expect((await leerMemoria()).get(REPORTE)).toEqual({
      idReporte: REPORTE,
      preguntado: true,
      voto: 'NEGACION',
    });
  });

  it('la cola recuerda los reportes propios y los duplicados como confirmación', async () => {
    let n = 0;
    const { pedir } = servidor(() =>
      ++n === 1
        ? json({ resultado: 'CREADO', reporte: { id: 'propio' } }, 201)
        : json({ resultado: 'DUPLICADO', reporte: { id: 'ajeno' } }),
    );
    await encolar({ codigoCategoria: 'bloqueo', ...AQUI });
    await encolar({ codigoCategoria: 'robo', ...AQUI });

    await enviarPendientes(API, pedir);

    const memoria = await leerMemoria();
    expect(memoria.get('propio')).toMatchObject({ propio: true });
    expect(memoria.get('ajeno')).toMatchObject({ voto: 'CONFIRMACION' });
  });
});

describe('votos «¿Sigue ahí?» (HU-03)', () => {
  it('HU-03: confirma con la posición de quien vota y lo recuerda', async () => {
    const { pedir, pedidos } = servidor(() => json({ peso: 1, decision: 'CONFIRMAR' }));

    const resultado = await votar(API, REPORTE, 'CONFIRMACION', AQUI, pedir);

    expect(resultado).toEqual({ tipo: 'REGISTRADO', decision: 'CONFIRMAR' });
    const voto = pedidos.find((p) => p.url.endsWith(`/v1/reportes/${REPORTE}/confirmar`))!;
    expect(await voto.json()).toEqual(AQUI);
    expect(voto.headers.get('authorization')).toBe('Bearer tok');
    expect((await leerMemoria()).get(REPORTE)).toMatchObject({ voto: 'CONFIRMACION' });
  });

  it('HU-03: «Ya no está» usa la ruta de negar', async () => {
    const { pedir, pedidos } = servidor(() => json({ peso: 1, decision: 'NINGUNA' }));

    await votar(API, REPORTE, 'NEGACION', AQUI, pedir);

    expect(pedidos.some((p) => p.url.endsWith('/negar'))).toBe(true);
  });

  it('HU-03: el autor no puede votar; se recuerda como propio', async () => {
    const { pedir } = servidor(() => json({ codigo: 'AUTOR_NO_PUEDE_VOTAR' }, 403));

    const resultado = await votar(API, REPORTE, 'CONFIRMACION', AQUI, pedir);

    expect(resultado).toMatchObject({ tipo: 'RECHAZADO', codigo: 'AUTOR_NO_PUEDE_VOTAR' });
    expect((await leerMemoria()).get(REPORTE)).toMatchObject({ propio: true });
  });

  it('HU-03: un voto repetido se recuerda para no ofrecerlo de nuevo', async () => {
    const { pedir } = servidor(() => json({ codigo: 'YA_VOTO' }, 409));

    await votar(API, REPORTE, 'NEGACION', AQUI, pedir);

    expect((await leerMemoria()).get(REPORTE)?.voto).toBeDefined();
  });

  it('lejos del incidente es un rechazo que no se recuerda', async () => {
    const { pedir } = servidor(() => json({ codigo: 'DEMASIADO_LEJOS_PARA_VOTAR' }, 403));

    expect(await votar(API, REPORTE, 'CONFIRMACION', AQUI, pedir)).toMatchObject({
      codigo: 'DEMASIADO_LEJOS_PARA_VOTAR',
    });
    expect((await leerMemoria()).has(REPORTE)).toBe(false);
  });

  it('sin red o con un 5xx el voto no se encola: se informa', async () => {
    const { pedir } = servidor(() => json({}, 503));

    expect(await votar(API, REPORTE, 'CONFIRMACION', AQUI, sinRed)).toEqual({ tipo: 'SIN_RED' });
    expect(await votar(API, REPORTE, 'CONFIRMACION', AQUI, pedir)).toEqual({ tipo: 'SIN_RED' });
  });
});

describe('zonas suscritas (HU-07)', () => {
  const zona = {
    id: '44444444-4444-4444-8444-444444444444',
    centro: AQUI,
    radioM: 800,
    categorias: ['bloqueo'],
    creadoEn: '2026-10-18T12:00:00.000Z',
  };

  it('HU-07: lista, crea y elimina con el token del dispositivo', async () => {
    const { pedir, pedidos } = servidor((s) => {
      if (s.method === 'GET') return json({ zonas: [zona] });
      if (s.method === 'POST') return json(zona, 201);
      return json(null, 204);
    });

    expect(await listarZonas(API, pedir)).toEqual([zona]);
    expect(await crearZona(API, { ...AQUI, radioM: 800, categorias: ['bloqueo'] }, pedir)).toEqual(
      zona,
    );
    await eliminarZona(API, zona.id, pedir);

    const rutas = pedidos
      .filter((p) => p.url.includes('/v1/suscripciones'))
      .map((p) => `${p.method} ${new URL(p.url).pathname}`);
    expect(rutas).toEqual([
      'GET /v1/suscripciones',
      'POST /v1/suscripciones',
      `DELETE /v1/suscripciones/${zona.id}`,
    ]);
  });

  it('HU-07: la sexta zona se rechaza con su código', async () => {
    const { pedir } = servidor(() => json({ codigo: 'LIMITE_DE_ZONAS' }, 409));

    await expect(
      crearZona(API, { ...AQUI, radioM: 800, categorias: ['bloqueo'] }, pedir),
    ).rejects.toMatchObject({ rechazo: { codigo: 'LIMITE_DE_ZONAS' } });
  });

  it('un 5xx es un error sin código de rechazo', async () => {
    const { pedir } = servidor(() => json({}, 500));

    const error = await listarZonas(API, pedir).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorDeZona);
    expect((error as ErrorDeZona).rechazo).toBeNull();
  });
});
