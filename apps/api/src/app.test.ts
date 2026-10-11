import { InMemoryEventBus } from '@gis/event-bus';
import { createLogger, loadConfig, loadFeatureFlags } from '@gis/platform';
import type { ModuleDefinition, Queryable } from '@gis/platform';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';

const config = loadConfig({
  DATABASE_URL: 'postgres://gis:gis@localhost:5432/gis',
  CORS_ORIGIN: 'http://localhost:5173',
  APP_VERSION: '1.2.3',
});

const dbArriba: Queryable = { query: async () => [] };
const dbCaida: Queryable = {
  query: async () => {
    throw new Error('ECONNREFUSED');
  },
};

interface Opciones {
  db?: Queryable;
  env?: Record<string, string>;
  modules?: ModuleDefinition[];
  lineas?: string[];
}

function crear({ db = dbArriba, env = {}, modules = [], lineas = [] }: Opciones = {}) {
  return buildApp({
    config,
    flags: loadFeatureFlags(env),
    logger: createLogger('info', { write: (linea) => lineas.push(linea) }),
    db,
    bus: new InMemoryEventBus(),
    modules,
  });
}

describe('GET /health', () => {
  it('responde 200 con la versión cuando la base de datos responde', async () => {
    const app = await crear();

    const respuesta = await app.inject({ method: 'GET', url: '/health' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ status: 'ok', version: '1.2.3', database: 'up' });
  });

  it('responde 503 sin filtrar el error cuando la base de datos está caída', async () => {
    const app = await crear({ db: dbCaida });

    const respuesta = await app.inject({ method: 'GET', url: '/health' });

    expect(respuesta.statusCode).toBe(503);
    expect(respuesta.json()).toEqual({ status: 'degraded', version: '1.2.3', database: 'down' });
  });
});

describe('ID de correlación', () => {
  it('genera uno por solicitud, lo devuelve y lo escribe en los logs', async () => {
    const lineas: string[] = [];
    const app = await crear({ lineas });

    const respuesta = await app.inject({ method: 'GET', url: '/health' });

    const id = respuesta.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const registros = lineas.map((linea) => JSON.parse(linea) as { reqId?: string });
    expect(registros.some((registro) => registro.reqId === id)).toBe(true);
  });

  it('respeta el que envía el cliente', async () => {
    const app = await crear();

    const respuesta = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'cliente-1' },
    });

    expect(respuesta.headers['x-request-id']).toBe('cliente-1');
  });
});

describe('registro de módulos', () => {
  const moduloDePrueba = (name: string): ModuleDefinition => ({
    name,
    register: vi.fn((app) => {
      app.get(`/${name}`, async () => ({ modulo: name }));
    }),
  });

  it('registra un módulo opcional solo si su interruptor está encendido', async () => {
    const encendido = moduloDePrueba('heatmap');
    const apagado = moduloDePrueba('moderation');
    const app = await crear({
      env: { FEATURE_HEATMAP: 'true', FEATURE_MODERATION: 'false' },
      modules: [encendido, apagado],
    });

    expect((await app.inject({ method: 'GET', url: '/heatmap' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/moderation' })).statusCode).toBe(404);
    expect(apagado.register).not.toHaveBeenCalled();
  });

  it('registra siempre los módulos imprescindibles', async () => {
    const reports = moduloDePrueba('reports');

    await crear({ modules: [reports] });

    expect(reports.register).toHaveBeenCalledOnce();
  });
});
