import { spawnSync } from 'node:child_process';
import { BusDeEventosEnMemoria } from '@gis/event-bus';
import {
  crearDb,
  crearPool,
  crearRegistro,
  cargarConfig,
  cargarInterruptores,
} from '@gis/platform';
import type { Pool } from '@gis/platform';
import { POSTGIS_IMAGE } from '@gis/testing';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from './app.js';
import { TIPO_DE_CONTENIDO_PROBLEMA } from './http/errores.js';
import { apiDePrueba } from './tests/apoyo.js';

// Fase 11, prueba 3.1: con la base de datos detenida la API responde 503 con problem+json y
// el proceso sigue vivo. En local, sin Docker, la prueba se omite con aviso.
const hayDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
const ejecutar = hayDocker || process.env.CI === 'true';
if (!ejecutar) console.warn('Docker no disponible: se omite la prueba de la base de datos caída');

describe.skipIf(!ejecutar)('API con la base de datos caída', () => {
  let contenedor: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer(POSTGIS_IMAGE).start();
    pool = crearPool(contenedor.getConnectionUri());
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('responde 503 con problem+json y sin detalles de la conexión', async () => {
    const app = await construirApp({
      config: cargarConfig({
        DATABASE_URL: contenedor.getConnectionUri(),
        CORS_ORIGIN: 'http://localhost:5173',
      }),
      interruptores: cargarInterruptores({}),
      registro: crearRegistro('silent'),
      db: pool,
      bus: new BusDeEventosEnMemoria(),
      modulos: [],
      api: apiDePrueba(),
    });
    // Una ruta que consulta la base como lo hacen los repositorios: con Drizzle.
    const db = crearDb(pool);
    app.get('/prueba-consulta', async () => (await db.execute(sql`SELECT 1 AS uno`)).rows);

    const antes = await app.inject({ method: 'GET', url: '/prueba-consulta' });
    expect(antes.statusCode).toBe(200);

    await contenedor.stop();
    const respuesta = await app.inject({ method: 'GET', url: '/prueba-consulta' });

    expect(respuesta.statusCode).toBe(503);
    expect(respuesta.headers['content-type']).toContain(TIPO_DE_CONTENIDO_PROBLEMA);
    expect(respuesta.headers['retry-after']).toBeDefined();
    expect(respuesta.json()).toMatchObject({ status: 503, codigo: 'BASE_DE_DATOS_NO_DISPONIBLE' });
    expect(respuesta.body).not.toMatch(/ECONNREFUSED|5432|SELECT/i);
  }, 60_000);
});
