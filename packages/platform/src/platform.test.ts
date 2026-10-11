import { describe, expect, it } from 'vitest';
import {
  checkDatabase,
  ConfigError,
  createLogger,
  featureVariable,
  loadConfig,
  loadFeatureFlags,
} from './index.js';

const entornoValido = {
  DATABASE_URL: 'postgres://gis:gis@localhost:5432/gis',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('loadConfig', () => {
  it('aplica los valores por defecto', () => {
    expect(loadConfig(entornoValido)).toEqual({
      version: '0.0.0-dev',
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      databaseUrl: entornoValido.DATABASE_URL,
      corsOrigin: entornoValido.CORS_ORIGIN,
    });
  });

  it('convierte el puerto a número', () => {
    expect(loadConfig({ ...entornoValido, PORT: '8080' }).port).toBe(8080);
  });

  it('no arranca si falta una variable obligatoria y dice cuál', () => {
    const cargar = () => loadConfig({ CORS_ORIGIN: entornoValido.CORS_ORIGIN });

    expect(cargar).toThrow(ConfigError);
    expect(cargar).toThrow(/DATABASE_URL/);
  });

  it('rechaza valores inválidos', () => {
    expect(() => loadConfig({ ...entornoValido, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...entornoValido, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});

describe('loadFeatureFlags', () => {
  it('los módulos imprescindibles siempre están activos', () => {
    const flags = loadFeatureFlags({});

    expect(flags.isEnabled('reports')).toBe(true);
    expect(flags.isEnabled('verification')).toBe(true);
    expect(flags.isEnabled('identity')).toBe(true);
  });

  it('un módulo opcional está apagado salvo que su variable sea true', () => {
    const flags = loadFeatureFlags({ FEATURE_HEATMAP: 'true', FEATURE_MODERATION: 'false' });

    expect(flags.isEnabled('heatmap')).toBe(true);
    expect(flags.isEnabled('moderation')).toBe(false);
    expect(flags.isEnabled('classifier')).toBe(false);
  });

  it('traduce el nombre del módulo a su variable', () => {
    expect(featureVariable('open-data')).toBe('FEATURE_OPEN_DATA');
    expect(loadFeatureFlags({ FEATURE_OPEN_DATA: 'true' }).isEnabled('open-data')).toBe(true);
  });

  it('rechaza un valor que no sea true o false', () => {
    expect(() => loadFeatureFlags({ FEATURE_HEATMAP: 'si' })).toThrow(/FEATURE_HEATMAP/);
  });
});

describe('checkDatabase', () => {
  it('informa que la base de datos responde', async () => {
    await expect(checkDatabase({ query: async () => [] })).resolves.toEqual({ ok: true });
  });

  it('informa el error sin lanzarlo', async () => {
    const caida = {
      query: async () => {
        throw new Error('ECONNREFUSED');
      },
    };

    await expect(checkDatabase(caida)).resolves.toEqual({ ok: false, error: 'ECONNREFUSED' });
  });
});

describe('createLogger', () => {
  it('escribe JSON con el nivel configurado', () => {
    const lineas: string[] = [];
    const logger = createLogger('info', { write: (linea) => lineas.push(linea) });

    logger.debug('no se escribe');
    logger.info({ reqId: 'r-1' }, 'hola');

    expect(lineas).toHaveLength(1);
    expect(JSON.parse(lineas[0] ?? '')).toMatchObject({ msg: 'hola', reqId: 'r-1' });
  });
});
