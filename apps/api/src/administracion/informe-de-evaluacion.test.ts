import { describe, expect, it } from 'vitest';
import { informeDeEvaluacion } from './informe-de-evaluacion.js';

const datos = { conjunto: 'tools/clasificador/c.jsonl', totalDeEjemplos: 10, fecha: '2026-10-20' };

describe('informe de evaluación del clasificador (HU-10)', () => {
  it('reporta precisión, exhaustividad, la matriz y cada fallo', () => {
    const informe = informeDeEvaluacion(
      {
        clasificador: 'reglas-v1',
        ejemplosDePrueba: 4,
        metricas: {
          verdaderosPositivos: 1,
          falsosPositivos: 1,
          falsosNegativos: 1,
          verdaderosNegativos: 1,
          precision: 0.5,
          exhaustividad: 0.5,
          f1: 0.5,
        },
        fallos: [
          { texto: 'Préstamos | rápidos', esperado: 'SOSPECHOSO', motivos: [] },
          { texto: 'Oferta de pollo', esperado: 'NORMAL', motivos: ['SPAM'] },
        ],
      },
      datos,
    );

    expect(informe).toContain('| Precisión (de lo marcado, cuánto era sospechoso) | 50,0 % |');
    expect(informe).toContain('| **Sospechoso** | 1 | 1 |');
    expect(informe).toContain('| Falso negativo | Préstamos \\| rápidos | — |');
    expect(informe).toContain('| Falso positivo | Oferta de pollo | SPAM |');
  });

  it('sin fallos ni métricas definidas lo dice', () => {
    const informe = informeDeEvaluacion(
      {
        clasificador: 'sin ejemplos',
        ejemplosDePrueba: 0,
        metricas: {
          verdaderosPositivos: 0,
          falsosPositivos: 0,
          falsosNegativos: 0,
          verdaderosNegativos: 0,
          precision: null,
          exhaustividad: null,
          f1: null,
        },
        fallos: [],
      },
      datos,
    );

    expect(informe).toContain('| F1 | — |');
    expect(informe).toContain('Ninguno.');
  });
});
