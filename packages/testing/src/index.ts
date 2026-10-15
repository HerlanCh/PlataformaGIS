import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, inject } from 'vitest';

export { desplazar } from './geografia.js';
export { POSTGIS_IMAGE } from './image.js';

export interface TestDatabase {
  readonly url: string;
  readonly pool: pg.Pool;
  /** Cierra las conexiones y borra la base de datos. */
  close(): Promise<void>;
}

/** `false` cuando no hay Docker en local: las pruebas de integración se omiten. */
export const integrationAvailable = (): boolean => inject('postgisUrl') !== null;

/** `describe` que se omite cuando no hay PostGIS de pruebas disponible. */
export function describeIntegration(nombre: string, pruebas: () => void): void {
  describe.skipIf(!integrationAvailable())(nombre, pruebas);
}

/**
 * Crea una base de datos vacía y aislada dentro del PostGIS de pruebas.
 * Cada archivo de pruebas usa la suya, así pueden correr en paralelo.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const urlAdmin = inject('postgisUrl');
  if (urlAdmin === null) throw new Error('No hay PostGIS de pruebas: falta Docker');

  const nombre = `t_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: urlAdmin });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nombre}`);
  await admin.end();

  const url = new URL(urlAdmin);
  url.pathname = `/${nombre}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 5 });

  return {
    url: url.toString(),
    pool,
    close: async () => {
      await pool.end();
      const limpieza = new pg.Client({ connectionString: urlAdmin });
      await limpieza.connect();
      await limpieza.query(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`);
      await limpieza.end();
    },
  };
}
