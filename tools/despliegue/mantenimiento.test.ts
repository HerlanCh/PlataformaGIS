import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const raiz = new URL('../../', import.meta.url);
const leer = (ruta: string): string => readFileSync(new URL(ruta, raiz), 'utf8');

const TIPOS = ['correctiva', 'adaptativa', 'perfectiva', 'preventiva'];

const plantillas = readdirSync(new URL('.github/ISSUE_TEMPLATE/', raiz))
  .filter((archivo) => archivo !== 'config.yml')
  .map((archivo) => ({
    archivo,
    ...(parse(leer(`.github/ISSUE_TEMPLATE/${archivo}`)) as {
      labels: string[];
      body: { id?: string; validations?: { required?: boolean } }[];
    }),
  }));

const flujo = parse(leer('.github/workflows/revision-mensual.yml')) as {
  on: { schedule: { cron: string }[] };
  permissions: Record<string, string>;
  jobs: { abrir: { steps: { name?: string; run?: string }[] } };
};
const pasos = flujo.jobs.abrir.steps;

describe('Proceso de mantenimiento (ISO/IEC 14764)', () => {
  it('hay una plantilla por tipo de mantenimiento, cada una con su etiqueta, y no hay incidencias en blanco', () => {
    expect(plantillas.map((p) => p.labels).sort()).toEqual(TIPOS.map((t) => [t]).sort());
    expect(parse(leer('.github/ISSUE_TEMPLATE/config.yml'))).toMatchObject({
      blank_issues_enabled: false,
    });
  });

  it('una corrección exige los pasos para reproducir el fallo', () => {
    const correctiva = plantillas.find((p) => p.archivo === 'correctiva.yml')!;

    expect(correctiva.body.find((c) => c.id === 'pasos')?.validations?.required).toBe(true);
  });

  it('la revisión mensual crea las etiquetas que usan las plantillas', () => {
    const etiquetas = pasos.find((p) => p.name === 'Etiquetas de mantenimiento')!.run!;

    for (const tipo of TIPOS) expect(etiquetas).toContain(`gh label create ${tipo} --force`);
  });

  it('la revisión mensual corre el día 1, solo puede escribir incidencias y no se duplica', () => {
    const incidencia = pasos.find((p) => p.name === 'Incidencia del mes')!.run!;

    expect(flujo.on.schedule).toEqual([{ cron: '0 13 1 * *' }]);
    expect(flujo.permissions).toEqual({ contents: 'read', issues: 'write' });
    expect(incidencia).toContain('--body-file .github/revision-mensual.md');
    expect(incidencia).toContain('Ya existe');
  });

  it('la plantilla de PR pide la prueba que reproduce el fallo antes del arreglo', () => {
    expect(leer('.github/pull_request_template.md')).toMatch(
      /prueba que lo reproduce se escribió \*\*antes\*\*/,
    );
  });
});
