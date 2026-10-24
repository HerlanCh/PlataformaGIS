import { reportadorNulo } from '@gis/errores-remotos';
import type { ReportadorDeErrores } from '@gis/errores-remotos';
import { BusDeEventosEnMemoria } from '@gis/event-bus';
import { cargarConfig, cargarInterruptores, crearRegistro } from '@gis/platform';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../app.js';
import { cargarConfigHttp } from '../http/config-http.js';
import { apiDePrueba } from '../tests/apoyo.js';
import { reportadorDeLaApi } from './reportador.js';

const DSN = 'https://clave123@app.glitchtip.com/29130';

describe('Errores de la API a GlitchTip (roadmap 12)', () => {
  it('sin SENTRY_DSN no se envía nada', () => {
    const config = cargarConfigHttp({});

    expect(config.errores).toBeNull();
    expect(reportadorDeLaApi(config.errores, 'v1')).toBe(reportadorNulo);
  });

  it('con SENTRY_DSN envía a GlitchTip con la versión y el entorno', async () => {
    const config = cargarConfigHttp({ SENTRY_DSN: DSN, SENTRY_ENVIRONMENT: 'staging' });
    const enviar = vi.fn(() => Promise.resolve());

    reportadorDeLaApi(config.errores, 'abc123', enviar).reportar(new Error('falló'));
    await Promise.resolve();

    const [url, cuerpo] = enviar.mock.calls[0] as unknown as [string, string];
    expect(url).toBe(
      'https://app.glitchtip.com/api/29130/store/?sentry_key=clave123&sentry_version=7',
    );
    expect(JSON.parse(cuerpo)).toMatchObject({
      platform: 'node',
      environment: 'staging',
      release: 'abc123',
    });
  });

  it('SENTRY_DSN debe ser una URL, y el entorno por defecto es producción', () => {
    expect(() => cargarConfigHttp({ SENTRY_DSN: 'no-es-url' })).toThrow(/SENTRY_DSN/);
    expect(cargarConfigHttp({ SENTRY_DSN: DSN }).errores).toEqual({
      dsn: DSN,
      entorno: 'produccion',
    });
  });
});

describe('Errores HTTP que se reportan (roadmap 12)', () => {
  const montar = async (reportador: ReportadorDeErrores) => {
    const app = await construirApp({
      config: cargarConfig({
        DATABASE_URL: 'postgres://gis:gis@localhost:5432/gis',
        CORS_ORIGIN: 'http://localhost:5173',
      }),
      interruptores: cargarInterruptores({}),
      registro: crearRegistro('silent'),
      db: { query: async () => [] },
      bus: new BusDeEventosEnMemoria(),
      modulos: [],
      api: apiDePrueba(),
      reportador,
    });
    app.get('/falla/:id', () => {
      throw new Error('inesperado');
    });
    app.get('/no-encontrado', () => {
      throw Object.assign(new Error('no'), { statusCode: 404 });
    });
    return app;
  };

  it('RNF-08: un 500 se reporta con el patrón de la ruta, no con la URL', async () => {
    const reportar = vi.fn();
    const app = await montar({ reportar });

    const respuesta = await app.inject({ url: '/falla/00000000-0000-4000-8000-000000000001' });

    expect(respuesta.statusCode).toBe(500);
    expect(reportar).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      ruta: 'GET /falla/:id',
    });
  });

  it('los errores 4xx no se reportan', async () => {
    const reportar = vi.fn();
    const app = await montar({ reportar });

    await app.inject({ url: '/no-encontrado' });
    await app.inject({ url: '/v1/no-existe' });

    expect(reportar).not.toHaveBeenCalled();
  });
});
