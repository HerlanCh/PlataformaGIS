import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConsultarMetricas } from '@gis/module-metrics';
import type { RepositorioDeMetricas } from '@gis/module-metrics';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportarMetricas } from './piloto.js';

let raiz: string;

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'piloto-'));
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

const ID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';

/** Un reporte del 24 de octubre y nada de actividad. */
const consultar = () =>
  new ConsultarMetricas({
    buscarRegistros: () =>
      Promise.resolve([
        {
          idReporte: ID,
          codigoCategoria: 'bloqueo',
          esOficial: false,
          creadoEn: new Date('2026-10-24T12:00:00.000Z'),
          primeraConfirmacionEn: null,
          confirmadoEn: null,
          cierre: 'CADUCIDAD',
          cerradoEn: new Date('2026-10-24T18:00:00.000Z'),
        },
      ]),
    actividadEntre: () => Promise.resolve([]),
  } as unknown as RepositorioDeMetricas);

describe('pnpm piloto:metricas (Fase 13)', () => {
  it('devuelve el resumen del periodo sin escribir nada si no hay destino', async () => {
    const salida = await exportarMetricas({
      raiz,
      desde: '2026-10-24',
      hasta: '2026-10-24',
      consultar: consultar(),
    });

    expect(salida).toMatchObject({ csv: null, filas: 0 });
    expect(salida.resumen.reportes.total).toBe(1);
  });

  it('escribe los reportes del periodo en CSV dentro del repositorio', async () => {
    const salida = await exportarMetricas({
      raiz,
      desde: '2026-10-24',
      hasta: '2026-10-24',
      destino: 'metricas.csv',
      consultar: consultar(),
    });

    expect(salida).toMatchObject({ csv: join(raiz, 'metricas.csv'), filas: 1 });
    expect(await readFile(join(raiz, 'metricas.csv'), 'utf8')).toContain(
      `${ID},bloqueo,false,2026-10-24T12:00:00.000Z,,,CADUCIDAD,2026-10-24T18:00:00.000Z`,
    );
  });

  it('no escribe fuera del repositorio ni sin extensión .csv', async () => {
    const pedir = (destino: string) =>
      exportarMetricas({
        raiz,
        desde: '2026-10-24',
        hasta: '2026-10-24',
        destino,
        consultar: consultar(),
      });

    await expect(pedir('../fuera.csv')).rejects.toThrow(/dentro del repositorio/);
    await expect(pedir('metricas.txt')).rejects.toThrow(/\.csv/);
  });
});
