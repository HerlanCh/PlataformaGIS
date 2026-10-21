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
import { evaluarReinicio } from './fiabilidad.js';
import type { EstadoEnBase, Envio } from './fiabilidad.js';
import { urlDeBaseLocal } from './base-local.js';

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

describe('urlDeBaseLocal', () => {
  it('acepta una base en la máquina local', () => {
    const url = 'postgres://gis:gis@localhost:5433/gis';

    expect(urlDeBaseLocal(url, 'La prueba')).toBe(url);
    expect(urlDeBaseLocal('postgres://g@127.0.0.1/gis', 'La prueba')).toContain('127.0.0.1');
  });

  it('rechaza una base remota o ausente', () => {
    expect(() => urlDeBaseLocal('postgres://g@ep-1.neon.tech/gis', 'La prueba')).toThrow(
      'La prueba solo corre en una base local, no en "ep-1.neon.tech"',
    );
    expect(() => urlDeBaseLocal(undefined, 'La prueba')).toThrow('Falta DATABASE_URL');
  });
});

describe('evaluarReinicio', () => {
  const creado = (clave: string, reintentado = false): Envio => ({
    clave,
    resultado: 'CREADO',
    idReporte: `id-${clave}`,
    reintentado,
    reenvioCoincide: true,
  });
  const sano: EstadoEnBase = { filas: 1, eventos: 1, publicados: 1 };

  it('cumple si cada reporte creado está una vez y su evento quedó publicado', () => {
    const envios = [creado('a'), creado('b', true), creado('c', true)];
    const enBase = new Map([
      ['a', sano],
      ['b', sano],
      ['c', sano],
    ]);

    expect(evaluarReinicio(envios, enBase, new Set(['b']))).toEqual({
      envios: 3,
      reintentados: 2,
      guardadosSinRespuesta: 1,
      creados: 3,
      reportesPerdidos: 0,
      reportesDuplicados: 0,
      eventosPerdidos: 0,
      eventosDuplicados: 0,
      reenviosInconsistentes: 0,
      cumple: true,
    });
  });

  it('un duplicado espacial no exige fila propia', () => {
    const duplicado: Envio = {
      clave: 'd',
      resultado: 'DUPLICADO',
      idReporte: 'x',
      reintentado: false,
      reenvioCoincide: true,
    };

    expect(evaluarReinicio([duplicado], new Map(), new Set()).cumple).toBe(true);
  });

  it('detecta reportes y eventos perdidos o duplicados', () => {
    const sinRespuesta: Envio = {
      clave: 'z',
      resultado: null,
      idReporte: null,
      reintentado: true,
      reenvioCoincide: false,
    };
    const envios = [creado('a'), creado('b'), creado('c'), sinRespuesta];
    const enBase = new Map<string, EstadoEnBase>([
      ['b', { filas: 2, eventos: 1, publicados: 1 }],
      ['c', { filas: 1, eventos: 2, publicados: 0 }],
    ]);

    expect(evaluarReinicio(envios, enBase, new Set())).toMatchObject({
      reportesPerdidos: 2,
      reportesDuplicados: 1,
      eventosPerdidos: 2,
      eventosDuplicados: 1,
      reenviosInconsistentes: 1,
      cumple: false,
    });
  });
});
