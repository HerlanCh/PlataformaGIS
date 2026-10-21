import type { RepositorioDeReportes, Reporte } from '@gis/module-reports';
import type { UltimaDecision } from '@gis/module-moderation';
import { idReporte } from '@gis/shared-kernel';
import type { IdReporte } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { fuenteDeDecisiones } from './puentes.js';

const id = (n: number) => idReporte(`6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`);

/** Solo `buscarPorIds`: lo único que usa el puente. Anota cada lote que se pide. */
function reportesFalsos(descripciones: Map<IdReporte, string | null>) {
  const lotes: (readonly IdReporte[])[] = [];
  const reportes = {
    buscarPorIds(ids: readonly IdReporte[]) {
      lotes.push(ids);
      return Promise.resolve(
        ids
          .filter((i) => descripciones.has(i))
          .map((i) => ({ id: i, descripcion: descripciones.get(i) ?? null }) as unknown as Reporte),
      );
    },
  } as unknown as RepositorioDeReportes;
  return { reportes, lotes };
}

describe('fuenteDeDecisiones (HU-10)', () => {
  it('une la última decisión de moderación con la descripción del reporte, por lotes', async () => {
    const decisiones: UltimaDecision[] = [
      { idReporte: id(1), accion: 'RECHAZAR' },
      { idReporte: id(2), accion: 'MANTENER' },
      { idReporte: id(3), accion: 'RECHAZAR' },
    ];
    const { reportes, lotes } = reportesFalsos(
      new Map([
        [id(1), 'Promo en https://x.example'],
        [id(2), null],
      ]),
    );

    const fuente = fuenteDeDecisiones(
      { ultimasDecisiones: () => Promise.resolve(decisiones) },
      reportes,
      2,
    );

    expect(await fuente.decisiones()).toEqual([
      { accion: 'RECHAZAR', descripcion: 'Promo en https://x.example' },
      { accion: 'MANTENER', descripcion: null },
      { accion: 'RECHAZAR', descripcion: null },
    ]);
    expect(lotes).toEqual([[id(1), id(2)], [id(3)]]);
  });
});
