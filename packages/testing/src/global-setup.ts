import { spawnSync } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { POSTGIS_IMAGE } from './image.js';

declare module 'vitest' {
  export interface ProvidedContext {
    /** URL de administración del PostGIS de pruebas, o `null` si no hay Docker. */
    postgisUrl: string | null;
  }
}

/**
 * Arranca un único contenedor PostGIS para toda la ejecución. Cada archivo de pruebas
 * crea dentro su propia base de datos (`createTestDatabase`).
 * En la CI Docker es obligatorio; en local, sin Docker, las pruebas de integración se omiten.
 */
export default async function setup(project: TestProject): Promise<(() => Promise<void>) | void> {
  const hayDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
  if (!hayDocker && process.env.CI !== 'true') {
    console.warn('Docker no disponible: se omiten las pruebas de integración con PostGIS');
    project.provide('postgisUrl', null);
    return;
  }

  const contenedor = await new PostgreSqlContainer(POSTGIS_IMAGE).start();
  project.provide('postgisUrl', contenedor.getConnectionUri());

  return async () => {
    await contenedor.stop();
  };
}
