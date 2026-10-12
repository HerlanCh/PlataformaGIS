import { describe, expect, it } from 'vitest';
import {
  AREA_DE_CARGA,
  CATEGORIAS_DE_CARGA,
  generadorAleatorio,
  idSintetico,
  puntoSintetico,
  reporteSintetico,
  zonaSintetica,
} from './datos-sinteticos.js';
import { leerPlan, percentil } from './estadisticas.js';

const ahora = new Date('2026-10-12T12:00:00.000Z');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

describe('percentil', () => {
  const muestras = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  it.each([
    [50, 50],
    [95, 100],
    [90, 90],
    [100, 100],
    [1, 10],
  ])('el p%d de diez muestras es %d', (porcentaje, esperado) => {
    expect(percentil(muestras, porcentaje)).toBe(esperado);
  });

  it('no depende del orden de las muestras ni las modifica', () => {
    const desordenadas = [100, 10, 50];

    expect(percentil(desordenadas, 50)).toBe(50);
    expect(desordenadas).toEqual([100, 10, 50]);
  });

  it.each([0, -1, 101, Number.NaN])('rechaza el porcentaje %d', (porcentaje) => {
    expect(() => percentil(muestras, porcentaje)).toThrow(RangeError);
  });

  it('rechaza una lista vacía', () => {
    expect(() => percentil([], 95)).toThrow(RangeError);
  });
});

describe('leerPlan', () => {
  it('reconoce un plan que usa el índice', () => {
    const plan = [
      'Bitmap Heap Scan on reportes  (cost=4.33..15.10 rows=3 width=96)',
      '  ->  Bitmap Index Scan on reportes_ubicacion_publica_idx  (cost=0.00..4.33 rows=3)',
    ].join('\n');

    expect(leerPlan(plan)).toEqual({ usaIndice: true, recorridosCompletos: [] });
  });

  it('detecta el recorrido completo de una tabla, también en paralelo', () => {
    const plan = [
      'Gather  (cost=1000.00..4000.00 rows=10 width=96)',
      '  ->  Parallel Seq Scan on reportes  (cost=0.00..3000.00 rows=4 width=96)',
      '  ->  Seq Scan on zonas_suscritas  (cost=0.00..30.00 rows=4 width=96)',
      '  ->  Seq Scan on reportes  (cost=0.00..3000.00 rows=4 width=96)',
    ].join('\n');

    expect(leerPlan(plan)).toEqual({
      usaIndice: false,
      recorridosCompletos: ['reportes', 'zonas_suscritas'],
    });
  });
});

describe('datos sintéticos', () => {
  it('la misma semilla produce la misma carga', () => {
    const carga = (semilla: number) => {
      const azar = generadorAleatorio(semilla);
      return Array.from({ length: 20 }, () => reporteSintetico(ahora, azar));
    };

    expect(carga(42)).toEqual(carga(42));
    expect(carga(42)).not.toEqual(carga(43));
  });

  it('semillas distintas producen cargas distintas', () => {
    expect(generadorAleatorio(1)()).not.toBe(generadorAleatorio(2)());
  });

  it('todos los puntos caen dentro del área de carga', () => {
    const azar = generadorAleatorio(7);

    for (let i = 0; i < 2000; i += 1) {
      const { latitud, longitud } = puntoSintetico(azar);
      expect(latitud).toBeGreaterThanOrEqual(AREA_DE_CARGA.latitudMin);
      expect(latitud).toBeLessThanOrEqual(AREA_DE_CARGA.latitudMax);
      expect(longitud).toBeGreaterThanOrEqual(AREA_DE_CARGA.longitudMin);
      expect(longitud).toBeLessThanOrEqual(AREA_DE_CARGA.longitudMax);
    }
  });

  it('los reportes cumplen las restricciones de la tabla', () => {
    const azar = generadorAleatorio(11);
    const reportes = Array.from({ length: 3000 }, () => reporteSintetico(ahora, azar));
    const codigos = CATEGORIAS_DE_CARGA.map((c) => c.codigo);

    for (const reporte of reportes) {
      expect(codigos).toContain(reporte.codigoCategoria);
      // Un confirmado lleva su primera extensión: el 50 % del TTL.
      const confirmado = reporte.estado === 'CONFIRMADO';
      expect(reporte.extensiones).toBe(confirmado ? 1 : 0);
      expect(reporte.caducaEn.getTime() - reporte.creadoEn.getTime()).toBe(
        reporte.ttlMinutos * 60_000 * (confirmado ? 1.5 : 1),
      );
      expect(reporte.motivoRechazo).toBe(reporte.estado === 'RECHAZADO' ? 'MODERACION' : null);
      if (reporte.estado === 'CONFIRMADO') expect(reporte.caducaEn > ahora).toBe(true);
      if (reporte.estado !== 'ACTIVO' && reporte.estado !== 'CONFIRMADO') {
        expect(reporte.caducaEn < ahora).toBe(true);
      }
    }
    // Hay reportes de todos los estados, y algunos `ACTIVO` con la caducidad ya vencida.
    expect(new Set(reportes.map((r) => r.estado)).size).toBe(5);
    expect(reportes.some((r) => r.estado === 'ACTIVO' && r.caducaEn < ahora)).toBe(true);
    expect(reportes.some((r) => r.estado === 'ACTIVO' && r.caducaEn > ahora)).toBe(true);
  });

  it('las zonas cumplen las restricciones de la tabla', () => {
    const azar = generadorAleatorio(3);

    for (let i = 0; i < 1000; i += 1) {
      const zona = zonaSintetica(azar);
      expect(zona.radioM).toBeGreaterThanOrEqual(100);
      expect(zona.radioM).toBeLessThanOrEqual(2000);
      expect(zona.categorias.length).toBeGreaterThan(0);
      expect(new Set(zona.categorias).size).toBe(zona.categorias.length);
    }
  });

  it('los identificadores sintéticos son UUID válidos y distintos por serie', () => {
    expect(idSintetico('f', 1)).toMatch(UUID);
    expect(idSintetico('e', 99_999)).toMatch(UUID);
    expect(idSintetico('f', 1)).not.toBe(idSintetico('f', 2));
  });
});
