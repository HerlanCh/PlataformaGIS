import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(raiz, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');
const configuracion = path.join(raiz, '.dependency-cruiser.cjs');

interface Violacion {
  regla: string;
  desde: string;
  hacia: string;
}

/** Ejecuta dependency-cruiser con las reglas reales sobre `directorio`. */
function cruzar(directorio: string, rutas: string[]): Violacion[] {
  const { stdout } = spawnSync(
    process.execPath,
    [cli, '--config', configuracion, '--output-type', 'json', ...rutas],
    { cwd: directorio, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const resultado = JSON.parse(stdout) as {
    summary: { violations: { rule: { name: string }; from: string; to: string }[] };
  };
  return resultado.summary.violations.map((v) => ({
    regla: v.rule.name,
    desde: v.from,
    hacia: v.to,
  }));
}

describe('RNF-01: reglas de arquitectura', () => {
  let violaciones: Violacion[];

  beforeAll(() => {
    violaciones = cruzar(path.join(raiz, 'tools/architecture/fixtures'), ['packages', 'apps']);
  }, 60_000);

  const casos: [regla: string, desde: string, hacia: string][] = [
    [
      'dominio-solo-shared-kernel',
      'packages/modules/alfa/domain/viola-infra.ts',
      'packages/modules/alfa/adapters/repo.ts',
    ],
    ['dominio-solo-shared-kernel', 'packages/modules/alfa/domain/viola-infra.ts', 'fs'],
    [
      'aplicacion-no-importa-adaptadores',
      'packages/modules/alfa/application/viola-adaptador.ts',
      'packages/modules/alfa/adapters/repo.ts',
    ],
    [
      'modulo-no-importa-otro-modulo',
      'packages/modules/beta/application/viola-otro-modulo.ts',
      'packages/modules/alfa/index.ts',
    ],
    [
      'solo-apps-importan-modulos',
      'packages/platform/viola-modulo.ts',
      'packages/modules/beta/index.ts',
    ],
    [
      'apps-solo-importan-el-index-del-modulo',
      'apps/api/viola-interno.ts',
      'packages/modules/beta/domain/ok.ts',
    ],
    ['paquetes-no-importan-apps', 'packages/platform/viola-app.ts', 'apps/api/main.ts'],
  ];

  it.each(casos)('rechaza %s: %s → %s', (regla, desde, hacia) => {
    expect(violaciones).toContainEqual({ regla, desde, hacia });
  });

  it('no marca las importaciones permitidas', () => {
    // Cada violación detectada es una de las plantadas a propósito: no hay falsos positivos.
    expect(violaciones).toHaveLength(casos.length);
  });

  it('el código real no tiene violaciones', () => {
    expect(cruzar(raiz, ['packages', 'apps'])).toEqual([]);
  }, 60_000);
});
