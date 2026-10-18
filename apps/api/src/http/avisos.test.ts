import { BusDeEventosEnMemoria } from '@gis/event-bus';
import { cargarConfig, cargarInterruptores, crearRegistro } from '@gis/platform';
import type { Registro } from '@gis/platform';
import { codigoCategoria, idReporte, idUsuario, PuntoGeo } from '@gis/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../app.js';
import type { AvisosPush } from '../composicion/casos-de-uso.js';
import {
  enviadorDeAvisos,
  EnviadorDeNotificacionesEnRegistro,
  EnviadorDeNotificacionesPush,
} from '../composicion/manejadores.js';
import { apiDePrueba, casosFalsos } from '../tests/apoyo.js';
import { cargarConfigHttp } from './config-http.js';

const USUARIO = '11111111-1111-4111-8111-111111111111';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';
const KEYS = {
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ',
  auth: 'tBHItJI5svbpez7KI4CCXg',
};

async function crear(avisosPush: AvisosPush | null) {
  const api = apiDePrueba({ casos: casosFalsos({ avisosPush }) });
  const app = await construirApp({
    config: cargarConfig({
      DATABASE_URL: 'postgres://gis:gis@localhost:5432/gis',
      CORS_ORIGIN: 'http://localhost:5173',
    }),
    interruptores: cargarInterruptores({}),
    registro: crearRegistro('silent'),
    db: { query: () => Promise.resolve([]) },
    bus: new BusDeEventosEnMemoria(),
    modulos: [],
    api,
  });
  const { token } = await api.tokens.firmar({ idUsuario: USUARIO, rol: 'CIUDADANO' });
  return { app, token };
}

const avisosFalsos = () => ({
  registrar: { ejecutar: vi.fn(() => Promise.resolve({} as never)) },
  eliminar: { ejecutar: vi.fn(() => Promise.resolve()) },
  clavePublica: 'BClavePublicaVapid',
});

describe('rutas de avisos Web Push (HU-08)', () => {
  it('HU-08: entrega la clave pública sin token', async () => {
    const { app } = await crear(avisosFalsos());

    const respuesta = await app.inject({ method: 'GET', url: '/v1/notificaciones/clave-publica' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ clavePublica: 'BClavePublicaVapid' });
  });

  it('HU-08: registra la suscripción del dispositivo a nombre del usuario del token', async () => {
    const avisos = avisosFalsos();
    const { app, token } = await crear(avisos);

    const respuesta = await app.inject({
      method: 'POST',
      url: '/v1/notificaciones/push',
      headers: { authorization: `Bearer ${token}` },
      payload: { endpoint: ENDPOINT, keys: KEYS },
    });

    expect(respuesta.statusCode).toBe(204);
    expect(avisos.registrar.ejecutar).toHaveBeenCalledWith({
      idUsuario: USUARIO,
      endpoint: ENDPOINT,
      ...KEYS,
    });
  });

  it('HU-08: da de baja el dispositivo', async () => {
    const avisos = avisosFalsos();
    const { app, token } = await crear(avisos);

    const respuesta = await app.inject({
      method: 'DELETE',
      url: '/v1/notificaciones/push',
      headers: { authorization: `Bearer ${token}` },
      payload: { endpoint: ENDPOINT },
    });

    expect(respuesta.statusCode).toBe(204);
    expect(avisos.eliminar.ejecutar).toHaveBeenCalledWith({
      idUsuario: USUARIO,
      endpoint: ENDPOINT,
    });
  });

  it('sin token es 401 y con un endpoint inválido es 400', async () => {
    const { app, token } = await crear(avisosFalsos());

    const sinToken = await app.inject({
      method: 'POST',
      url: '/v1/notificaciones/push',
      payload: { endpoint: ENDPOINT, keys: KEYS },
    });
    const invalido = await app.inject({
      method: 'POST',
      url: '/v1/notificaciones/push',
      headers: { authorization: `Bearer ${token}` },
      payload: { endpoint: 'no-es-url', keys: KEYS },
    });

    expect(sinToken.statusCode).toBe(401);
    expect(invalido.statusCode).toBe(400);
  });

  it('con los avisos apagados las rutas no existen (404)', async () => {
    const { app } = await crear(null);

    const respuesta = await app.inject({ method: 'GET', url: '/v1/notificaciones/clave-publica' });

    expect(respuesta.statusCode).toBe(404);
  });
});

describe('canal de avisos de la raíz de composición', () => {
  const registro = () => ({ info: vi.fn(), warn: vi.fn() }) as unknown as Registro;
  const aviso = {
    idUsuario: idUsuario(USUARIO),
    idReporte: idReporte('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f'),
    codigoCategoria: codigoCategoria('bloqueo'),
    publicLocation: PuntoGeo.crear(-16.4955, -68.1336),
  };
  const vapid = { publica: 'pub', privada: 'priv', contacto: 'mailto:x@example.org' };

  it('HU-08: envía por Web Push la categoría y la ubicación pública, y lo registra', async () => {
    const enviar = {
      ejecutar: vi.fn(() => Promise.resolve({ enviados: 1, vencidas: 0, fallidos: 0 })),
    };
    const log = registro();

    await new EnviadorDeNotificacionesPush(enviar, log).enviar(aviso);

    expect(enviar.ejecutar).toHaveBeenCalledWith(aviso.idUsuario, {
      idReporte: aviso.idReporte,
      codigoCategoria: 'bloqueo',
      publicLocation: { latitud: -16.4955, longitud: -68.1336 },
    });
    expect(log.info).toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('los envíos fallidos se registran como advertencia, sin lanzar', async () => {
    const enviar = {
      ejecutar: vi.fn(() => Promise.resolve({ enviados: 0, vencidas: 0, fallidos: 2 })),
    };
    const log = registro();

    await new EnviadorDeNotificacionesPush(enviar, log).enviar(aviso);

    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ fallidos: 2 }),
      expect.any(String),
    );
  });

  it('sin el módulo encendido o sin claves VAPID, los avisos quedan en el log', () => {
    const db = {} as never;
    const encendido = cargarInterruptores({ FEATURE_NOTIFICATIONS: 'true' });

    expect(enviadorDeAvisos(db, cargarInterruptores({}), registro(), vapid)).toBeInstanceOf(
      EnviadorDeNotificacionesEnRegistro,
    );
    expect(enviadorDeAvisos(db, encendido, registro(), null)).toBeInstanceOf(
      EnviadorDeNotificacionesEnRegistro,
    );
    expect(enviadorDeAvisos(db, encendido, registro(), vapid)).toBeInstanceOf(
      EnviadorDeNotificacionesPush,
    );
  });

  it('la configuración lee las claves VAPID; sin ambas no hay avisos push', () => {
    expect(cargarConfigHttp({}).vapid).toBeNull();
    expect(cargarConfigHttp({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: '' }).vapid).toBeNull();
    expect(cargarConfigHttp({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' }).vapid).toEqual({
      publica: 'pub',
      privada: 'priv',
      contacto: 'mailto:alerta-lp@example.org',
    });
    expect(
      cargarConfigHttp({
        VAPID_PUBLIC_KEY: 'p',
        VAPID_PRIVATE_KEY: 'q',
        VAPID_SUBJECT: 'mailto:a@b.c',
      }).vapid?.contacto,
    ).toBe('mailto:a@b.c');
  });
});
