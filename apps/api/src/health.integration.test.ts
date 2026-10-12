import { spawnSync } from 'node:child_process';
import { InMemoryEventBus } from '@gis/event-bus';
import { createLogger, createPool, loadConfig, loadFeatureFlags } from '@gis/platform';
import type { Pool } from '@gis/platform';
import { POSTGIS_IMAGE } from '@gis/testing';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

// En la CI Docker es obligatorio. En local, sin Docker, la prueba se omite con aviso.
const hayDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
const ejecutar = hayDocker || process.env.CI === 'true';
if (!ejecutar) console.warn('Docker no disponible: se omite la prueba de integración de /health');

describe.skipIf(!ejecutar)('GET /health contra PostGIS real', () => {
  let contenedor: StartedPostgreSqlContainer;
  let db: Pool;

  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer(POSTGIS_IMAGE).start();
    db = createPool(contenedor.getConnectionUri());
  }, 180_000);

  afterAll(async () => {
    await db?.end();
    await contenedor?.stop();
  });

  const crear = () =>
    buildApp({
      config: loadConfig({
        DATABASE_URL: contenedor.getConnectionUri(),
        CORS_ORIGIN: 'http://localhost:5173',
      }),
      flags: loadFeatureFlags({}),
      logger: createLogger('silent'),
      db,
      bus: new InMemoryEventBus(),
      modules: [],
    });

  it('informa la base de datos arriba', async () => {
    const respuesta = await (await crear()).inject({ method: 'GET', url: '/health' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('la imagen trae PostGIS disponible', async () => {
    const { rows } = await db.query('SELECT postgis_version() AS version');

    expect(rows[0].version).toMatch(/^3\./);
  });

  it('informa 503 cuando la base de datos deja de responder', async () => {
    const app = await crear();
    await contenedor.stop();

    const respuesta = await app.inject({ method: 'GET', url: '/health' });

    expect(respuesta.statusCode).toBe(503);
    expect(respuesta.json()).toMatchObject({ status: 'degraded', database: 'down' });
  }, 60_000);
});
