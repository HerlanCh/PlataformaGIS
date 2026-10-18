import { idUsuario } from '@gis/shared-kernel';
import type { IdUsuario } from '@gis/shared-kernel';
import { GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { describe, expect, it, vi } from 'vitest';
import { EmisorWebPush } from '../adapters/emisor-web-push.js';
import { EliminarSuscripcionPush } from '../application/eliminar-suscripcion-push.js';
import { EnviarAvisoPush } from '../application/enviar-aviso-push.js';
import { ErrorSuscripcionVencida } from '../application/ports.js';
import type { ContenidoDeAviso, EmisorPush } from '../application/ports.js';
import { RegistrarSuscripcionPush } from '../application/registrar-suscripcion-push.js';
import type { RepositorioDeSuscripcionesPush } from '../domain/ports.js';
import { idSuscripcionPush, SuscripcionPush } from '../domain/suscripcion-push.js';

const ana = idUsuario('11111111-1111-4111-8111-111111111111');
const beto = idUsuario('22222222-2222-4222-8222-222222222222');
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';
const CLAVES = {
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ',
  auth: 'tBHItJI5svbpez7KI4CCXg',
};

/** Mismo contrato que `RepositorioSuscripcionesPushPg`. */
class SuscripcionesEnMemoria implements RepositorioDeSuscripcionesPush {
  readonly filas = new Map<string, SuscripcionPush>();

  guardar(s: SuscripcionPush): Promise<void> {
    this.filas.set(s.endpoint, s);
    return Promise.resolve();
  }

  buscarPorUsuario(id: IdUsuario): Promise<readonly SuscripcionPush[]> {
    return Promise.resolve([...this.filas.values()].filter((s) => s.idUsuario === id));
  }

  eliminarPorEndpoint(endpoint: string, id?: IdUsuario): Promise<boolean> {
    const fila = this.filas.get(endpoint);
    if (!fila || (id && fila.idUsuario !== id)) return Promise.resolve(false);
    return Promise.resolve(this.filas.delete(endpoint));
  }
}

const registrar = (suscripciones: SuscripcionesEnMemoria) =>
  new RegistrarSuscripcionPush({
    suscripciones,
    reloj: new RelojFijo(),
    ids: new GeneradorDeIdSecuencial('eeeeeeee'),
  });

const dispositivo = (n: number, usuario = ana) =>
  SuscripcionPush.restaurar({
    id: idSuscripcionPush(`eeeeeeee-eeee-4eee-8eee-${String(n).padStart(12, '0')}`),
    idUsuario: usuario,
    endpoint: `${ENDPOINT}/${n}`,
    ...CLAVES,
    creadoEn: new Date(),
  });

const contenido: ContenidoDeAviso = {
  idReporte: '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f',
  codigoCategoria: 'bloqueo',
  publicLocation: { latitud: -16.4955, longitud: -68.1336 },
};

describe('RegistrarSuscripcionPush', () => {
  it('HU-08: guarda a dónde enviar los avisos del dispositivo', async () => {
    const suscripciones = new SuscripcionesEnMemoria();

    await registrar(suscripciones).ejecutar({ idUsuario: ana, endpoint: ENDPOINT, ...CLAVES });

    expect(await suscripciones.buscarPorUsuario(ana)).toMatchObject([
      { endpoint: ENDPOINT, ...CLAVES },
    ]);
  });

  it('el mismo endpoint registrado de nuevo pasa al usuario actual, sin duplicarse', async () => {
    const suscripciones = new SuscripcionesEnMemoria();
    await registrar(suscripciones).ejecutar({ idUsuario: ana, endpoint: ENDPOINT, ...CLAVES });

    await registrar(suscripciones).ejecutar({ idUsuario: beto, endpoint: ENDPOINT, ...CLAVES });

    expect(suscripciones.filas.size).toBe(1);
    expect(await suscripciones.buscarPorUsuario(beto)).toHaveLength(1);
  });

  it.each([
    ['un endpoint que no es https', { endpoint: 'http://push.test/x' }],
    ['un endpoint que no es URL', { endpoint: 'no-es-url' }],
    ['una clave fuera de base64 de URL', { auth: 'con espacios' }],
    ['una clave vacía', { p256dh: '' }],
  ])('rechaza %s', async (_caso, cambio) => {
    const suscripciones = new SuscripcionesEnMemoria();

    await expect(
      registrar(suscripciones).ejecutar({
        idUsuario: ana,
        endpoint: ENDPOINT,
        ...CLAVES,
        ...cambio,
      }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA', codigo: 'SUSCRIPCION_PUSH_INVALIDA' });
  });
});

describe('EliminarSuscripcionPush', () => {
  it('HU-08: borra solo la suscripción propia y es idempotente', async () => {
    const suscripciones = new SuscripcionesEnMemoria();
    await registrar(suscripciones).ejecutar({ idUsuario: ana, endpoint: ENDPOINT, ...CLAVES });
    const eliminar = new EliminarSuscripcionPush(suscripciones);

    await eliminar.ejecutar({ idUsuario: beto, endpoint: ENDPOINT });
    expect(suscripciones.filas.size).toBe(1);

    await eliminar.ejecutar({ idUsuario: ana, endpoint: ENDPOINT });
    await eliminar.ejecutar({ idUsuario: ana, endpoint: ENDPOINT });
    expect(suscripciones.filas.size).toBe(0);
  });
});

describe('EnviarAvisoPush', () => {
  it('HU-08: envía el aviso con la categoría y la ubicación pública a cada dispositivo', async () => {
    const suscripciones = new SuscripcionesEnMemoria();
    await suscripciones.guardar(dispositivo(1));
    await suscripciones.guardar(dispositivo(2));
    await suscripciones.guardar(dispositivo(3, beto));
    const emisor: EmisorPush = { enviar: vi.fn(() => Promise.resolve()) };

    const resultado = await new EnviarAvisoPush({ suscripciones, emisor }).ejecutar(ana, contenido);

    expect(resultado).toEqual({ enviados: 2, vencidas: 0, fallidos: 0 });
    expect(emisor.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: `${ENDPOINT}/1` }),
      contenido,
    );
  });

  it('una suscripción vencida (410) se borra; otro fallo se cuenta sin lanzar', async () => {
    const suscripciones = new SuscripcionesEnMemoria();
    for (const n of [1, 2, 3]) await suscripciones.guardar(dispositivo(n));
    const fallos: Record<string, Error> = {
      [`${ENDPOINT}/1`]: new ErrorSuscripcionVencida(),
      [`${ENDPOINT}/2`]: new Error('red'),
    };
    const emisor: EmisorPush = {
      enviar: (s) => {
        const fallo = fallos[s.endpoint];
        return fallo ? Promise.reject(fallo) : Promise.resolve();
      },
    };

    const resultado = await new EnviarAvisoPush({ suscripciones, emisor }).ejecutar(ana, contenido);

    expect(resultado).toEqual({ enviados: 1, vencidas: 1, fallidos: 1 });
    expect([...suscripciones.filas.keys()]).toEqual([`${ENDPOINT}/2`, `${ENDPOINT}/3`]);
  });
});

describe('EmisorWebPush', () => {
  const claves = { publica: 'pub', privada: 'priv', contacto: 'mailto:equipo@example.org' };

  it('HU-08: envía el contenido como JSON con VAPID, sin datos de la persona', async () => {
    const enviar = vi.fn(() => Promise.resolve({ statusCode: 201, body: '', headers: {} }));

    await new EmisorWebPush(claves, enviar).enviar(dispositivo(1), contenido);

    expect(enviar).toHaveBeenCalledWith(
      { endpoint: `${ENDPOINT}/1`, keys: CLAVES },
      JSON.stringify({ tipo: 'reporte-en-zona', ...contenido }),
      expect.objectContaining({
        vapidDetails: { subject: claves.contacto, publicKey: 'pub', privateKey: 'priv' },
      }),
    );
  });

  it.each([404, 410])('un %i del servicio push es una suscripción vencida', async (estado) => {
    const enviar = vi.fn(() =>
      Promise.reject(Object.assign(new Error('gone'), { statusCode: estado })),
    );
    const emisor = new EmisorWebPush(claves, enviar);

    await expect(emisor.enviar(dispositivo(1), contenido)).rejects.toBeInstanceOf(
      ErrorSuscripcionVencida,
    );
  });

  it('otros errores del servicio push se propagan', async () => {
    const enviar = vi.fn(() => Promise.reject(Object.assign(new Error('x'), { statusCode: 500 })));

    await expect(
      new EmisorWebPush(claves, enviar).enviar(dispositivo(1), contenido),
    ).rejects.toThrow('x');
  });
});
