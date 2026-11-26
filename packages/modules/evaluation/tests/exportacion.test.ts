import { describe, expect, it } from 'vitest';
import { ExportarEvaluacion } from '../application/exportar-evaluacion.js';
import { aCsv, COLUMNAS_EXPORTADAS } from '../domain/exportacion.js';
import type { Exportacion, NombreDeTabla } from '../domain/exportacion.js';

const vacia = Object.fromEntries(
  Object.keys(COLUMNAS_EXPORTADAS).map((t) => [t, []]),
) as unknown as Exportacion;

describe('exportación de la evaluación (ADR-007)', () => {
  it('HU-14: escribe el encabezado fijo, las horas en ISO y entre comillas lo que lleva coma o comillas', () => {
    const csv = aCsv('verificaciones', [
      {
        id_reporte: 'r1',
        resultado: 'REAL',
        fin_en: new Date('2026-11-22T15:30:00.000Z'),
        fuente: 'CAMPO',
        detalle_fuente: 'Visita, "a pie"',
        registrada_en: '2026-11-22T16:00:00.000Z',
      },
      {
        id_reporte: 'r2',
        resultado: 'FALSO',
        fin_en: null,
        fuente: 'SECUNDARIA',
        detalle_fuente: null,
        registrada_en: null,
      },
    ]);

    expect(csv).toBe(
      'id_reporte,resultado,fin_en,fuente,detalle_fuente,registrada_en\n' +
        'r1,REAL,2026-11-22T15:30:00.000Z,CAMPO,"Visita, ""a pie""",2026-11-22T16:00:00.000Z\n' +
        'r2,FALSO,,SECUNDARIA,,\n',
    );
  });

  it('HU-14: entrega un CSV por tabla, solo a un moderador', async () => {
    const exportar = new ExportarEvaluacion({ exportar: () => Promise.resolve(vacia) });

    const tablas = await exportar.ejecutar({ rolActor: 'MODERADOR' });

    expect(Object.keys(tablas).toSorted()).toEqual(Object.keys(COLUMNAS_EXPORTADAS).toSorted());
    for (const [tabla, csv] of Object.entries(tablas)) {
      expect(csv).toBe(`${COLUMNAS_EXPORTADAS[tabla as NombreDeTabla].join(',')}\n`);
    }
    await expect(exportar.ejecutar({ rolActor: 'CIUDADANO' })).rejects.toMatchObject({
      codigo: 'ROL_INSUFICIENTE',
    });
  });
});
