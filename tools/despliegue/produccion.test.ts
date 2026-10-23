import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const leer = (ruta: string): unknown =>
  parse(readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8'));

interface Servicio {
  name: string;
  autoDeploy?: boolean;
  startCommand: string;
  envVars: { key: string; value?: string }[];
}

interface Paso {
  name?: string;
  env?: Record<string, string>;
}

const servicios = (leer('render.yaml') as { services: Servicio[] }).services;
const produccion = servicios.find((s) => s.name === 'plataforma-gis-api-produccion')!;
const flujo = leer('.github/workflows/produccion.yml') as {
  jobs: { desplegar: { environment: { name: string }; steps: Paso[] } };
};
const migraciones = flujo.jobs.desplegar.steps.find((paso) => paso.name === 'Migraciones')!;

const interruptores = (pares: [string, string | undefined][]) =>
  Object.fromEntries(pares.filter(([clave]) => clave.startsWith('FEATURE_')));

describe('Pipeline de producción (roadmap 12)', () => {
  it('RNF-07: producción no se despliega sola al empujar a main', () => {
    expect(produccion.autoDeploy).toBe(false);
  });

  it('RNF-07: la API de producción no migra al arrancar: lo hace el pipeline antes', () => {
    expect(produccion.startCommand).not.toContain('db:migrate');
  });

  it('RNF-07: el despliegue espera la aprobación del environment de producción', () => {
    expect(flujo.jobs.desplegar.environment.name).toBe('produccion');
  });

  it('RNF-07: el paso de migraciones lleva las variables obligatorias de la configuración', () => {
    // `cargarConfig` (packages/platform) no tiene valor por defecto para estas dos.
    expect(Object.keys(migraciones.env ?? {})).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'CORS_ORIGIN']),
    );
  });

  it('RNF-07: el pipeline migra los mismos módulos que activa el servicio de producción', () => {
    const delServicio = interruptores(produccion.envVars.map((v) => [v.key, v.value]));
    const delPipeline = interruptores(Object.entries(migraciones.env ?? {}));

    expect(Object.keys(delServicio).length).toBeGreaterThan(0);
    expect(delPipeline).toEqual(delServicio);
  });
});
