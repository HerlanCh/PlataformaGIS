import { describe, expect, it } from 'vitest';
import { RADIO_DE_PREGUNTA_M, reporteParaPreguntar } from './cercania.js';
import { desdeCuando, filtrarReportes, hayFiltros, inicioDeHoy, SIN_FILTROS } from './filtros.js';
import { CENTRO_LA_PAZ, teselaDe } from './geo.js';
import type { ReportePublico } from './reportes.js';

const AHORA = new Date('2026-10-18T16:00:00.000Z'); // 12:00 en La Paz

const reporte = (
  id: string,
  cambios: Partial<ReportePublico> & { norteM?: number; haceMin?: number } = {},
): ReportePublico => {
  const { norteM = 0, haceMin = 10, ...resto } = cambios;
  return {
    id,
    codigoCategoria: 'bloqueo',
    estado: 'ACTIVO',
    publicLocation: {
      latitud: CENTRO_LA_PAZ.latitud + norteM / 111_195,
      longitud: CENTRO_LA_PAZ.longitud,
    },
    creadoEn: new Date(AHORA.getTime() - haceMin * 60_000).toISOString(),
    caducaEn: new Date(AHORA.getTime() + 3_600_000).toISOString(),
    ...resto,
  };
};

describe('filtros del mapa', () => {
  const lista = [
    reporte('reciente', { haceMin: 20 }),
    reporte('dos-horas', { haceMin: 120, codigoCategoria: 'robo' }),
    reporte('madrugada', { haceMin: 11 * 60 }), // 01:00 en La Paz
    reporte('ayer', { haceMin: 13 * 60, codigoCategoria: 'infraestructura' }), // 23:00 de ayer
  ];
  const ids = (filtrados: readonly ReportePublico[]) => filtrados.map((r) => r.id);

  it('sin filtros devuelve la misma lista', () => {
    expect(filtrarReportes(lista, SIN_FILTROS, AHORA)).toBe(lista);
    expect(hayFiltros(SIN_FILTROS)).toBe(false);
  });

  it('por antigüedad: última hora, 3 h y hoy (en la hora de La Paz)', () => {
    const con = (antiguedad: 'hora' | 'tres-horas' | 'hoy') =>
      ids(filtrarReportes(lista, { ocultas: [], antiguedad }, AHORA));

    expect(con('hora')).toEqual(['reciente']);
    expect(con('tres-horas')).toEqual(['reciente', 'dos-horas']);
    expect(con('hoy')).toEqual(['reciente', 'dos-horas', 'madrugada']);
  });

  it('las líneas apagadas no se muestran', () => {
    const filtros = { ocultas: ['robo', 'infraestructura'] as const, antiguedad: 'todos' as const };

    expect(ids(filtrarReportes(lista, filtros, AHORA))).toEqual(['reciente', 'madrugada']);
    expect(hayFiltros(filtros)).toBe(true);
  });

  it('el día empieza a medianoche de La Paz (UTC−4)', () => {
    expect(inicioDeHoy(AHORA).toISOString()).toBe('2026-10-18T04:00:00.000Z');
    expect(inicioDeHoy(new Date('2026-10-18T03:30:00.000Z')).toISOString()).toBe(
      '2026-10-17T04:00:00.000Z',
    );
    expect(desdeCuando('todos', AHORA)).toBeNull();
  });
});

describe('«¿Sigue ahí?» automático', () => {
  it('HU-03: pregunta por el más cercano a menos de 150 m', () => {
    const lista = [
      reporte('a-120', { norteM: 120 }),
      reporte('a-60', { norteM: 60 }),
      reporte('a-400', { norteM: 400 }),
    ];

    expect(reporteParaPreguntar(lista, CENTRO_LA_PAZ, new Set())?.id).toBe('a-60');
  });

  it('HU-03: no pregunta más allá de 150 m', () => {
    const lista = [reporte('lejos', { norteM: RADIO_DE_PREGUNTA_M + 30 })];

    expect(reporteParaPreguntar(lista, CENTRO_LA_PAZ, new Set())).toBeNull();
  });

  it('HU-03: ni por los propios, ni por los votados, ni por los ya preguntados', () => {
    const lista = [reporte('propio', { norteM: 10 }), reporte('otro', { norteM: 100 })];

    expect(reporteParaPreguntar(lista, CENTRO_LA_PAZ, new Set(['propio']))?.id).toBe('otro');
    expect(reporteParaPreguntar(lista, CENTRO_LA_PAZ, new Set(['propio', 'otro']))).toBeNull();
  });
});

describe('tesela inicial del mapa', () => {
  it('el centro de La Paz en zoom 15 cae en la tesela 10182/17906', () => {
    expect(teselaDe(CENTRO_LA_PAZ, 15)).toEqual({ x: 10182, y: 17906 });
    expect(teselaDe({ latitud: 0, longitud: 0 }, 1)).toEqual({ x: 1, y: 1 });
  });
});
