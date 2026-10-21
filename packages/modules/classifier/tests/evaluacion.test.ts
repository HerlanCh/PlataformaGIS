import { describe, expect, it } from 'vitest';
import { ClasificadorPorReglas } from '../adapters/clasificador-por-reglas.js';
import { EvaluarClasificador } from '../application/evaluar-clasificador.js';
import { aJsonl, deJsonl, ExportarConjuntoEtiquetado } from '../application/exportar-conjunto.js';
import type { DecisionModerada } from '../application/exportar-conjunto.js';
import { calcularMetricas, esDePrueba } from '../domain/evaluacion.js';
import type { Ejemplo } from '../domain/evaluacion.js';

describe('métricas del clasificador (HU-10)', () => {
  it('calcula precisión, exhaustividad y F1 de la matriz de confusión', () => {
    const m = calcularMetricas([
      { esperado: 'SOSPECHOSO', marcado: true },
      { esperado: 'SOSPECHOSO', marcado: true },
      { esperado: 'SOSPECHOSO', marcado: false },
      { esperado: 'NORMAL', marcado: true },
      { esperado: 'NORMAL', marcado: false },
    ]);

    expect(m).toMatchObject({
      verdaderosPositivos: 2,
      falsosNegativos: 1,
      falsosPositivos: 1,
      verdaderosNegativos: 1,
    });
    expect(m.precision).toBeCloseTo(2 / 3);
    expect(m.exhaustividad).toBeCloseTo(2 / 3);
    expect(m.f1).toBeCloseTo(2 / 3);
  });

  it('sin marcados ni sospechosos, las métricas no están definidas', () => {
    expect(calcularMetricas([{ esperado: 'NORMAL', marcado: false }])).toMatchObject({
      precision: null,
      exhaustividad: null,
      f1: null,
    });
  });

  it('la partición de prueba es estable y separa cerca de un 30 %', () => {
    const textos = Array.from({ length: 1000 }, (_, i) => `reporte número ${i}`);
    const deprueba = textos.filter((t) => esDePrueba(t));

    expect(textos.filter((t) => esDePrueba(t))).toEqual(deprueba);
    expect(deprueba.length).toBeGreaterThan(250);
    expect(deprueba.length).toBeLessThan(350);
  });
});

describe('EvaluarClasificador', () => {
  it('HU-10: mide las reglas solo sobre la partición de prueba y lista sus fallos', async () => {
    const ejemplos: Ejemplo[] = Array.from({ length: 60 }, (_, i) => ({
      texto: i % 2 === 0 ? `Visita https://spam${i}.example` : `Bloqueo número ${i} en la avenida`,
      etiqueta: i % 2 === 0 ? 'SOSPECHOSO' : 'NORMAL',
    }));
    ejemplos.push({ texto: 'Préstamos a sola firma número 7', etiqueta: 'SOSPECHOSO' });

    const resultado = await new EvaluarClasificador(new ClasificadorPorReglas()).ejecutar(ejemplos);

    const deprueba = ejemplos.filter((e) => esDePrueba(e.texto));
    expect(resultado.clasificador).toBe('reglas-v1');
    expect(resultado.ejemplosDePrueba).toBe(deprueba.length);
    expect(resultado.metricas.falsosPositivos).toBe(0);
    expect(resultado.fallos.every((f) => f.esperado === 'SOSPECHOSO')).toBe(true);
  });

  it('sin ejemplos devuelve métricas vacías', async () => {
    const resultado = await new EvaluarClasificador(new ClasificadorPorReglas()).ejecutar([]);

    expect(resultado).toMatchObject({ ejemplosDePrueba: 0, fallos: [] });
  });
});

describe('ExportarConjuntoEtiquetado', () => {
  it('HU-10: etiqueta los rechazos como sospechosos y lo mantenido como normal, sin repetir ni vacíos', async () => {
    const decisiones: DecisionModerada[] = [
      { accion: 'RECHAZAR', descripcion: 'Promo en https://x.example' },
      { accion: 'MANTENER', descripcion: ' Bloqueo en la Pérez ' },
      { accion: 'MANTENER', descripcion: 'Bloqueo en la Pérez' },
      { accion: 'RECHAZAR', descripcion: null },
    ];

    const ejemplos = await new ExportarConjuntoEtiquetado({
      decisiones: () => Promise.resolve(decisiones),
    }).ejecutar();

    expect(ejemplos).toEqual([
      { texto: 'Promo en https://x.example', etiqueta: 'SOSPECHOSO' },
      { texto: 'Bloqueo en la Pérez', etiqueta: 'NORMAL' },
    ]);
    expect(deJsonl(aJsonl(ejemplos))).toEqual(ejemplos);
    expect(aJsonl([])).toBe('');
  });

  it('rechaza una línea que no es un ejemplo', () => {
    expect(() => deJsonl('{"texto":"a","etiqueta":"QUIZAS"}')).toThrow('línea 1');
  });
});
