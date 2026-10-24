import { describe, expect, it } from 'vitest';
import {
  aMarkdown,
  analizar,
  leerCsv,
  mediana,
  porcentajeDeCiertos,
  tiempoDeAparicion,
  tiempoVisibleSinSerCierto,
} from './analizar.mjs';

// Datos ficticios, solo para probar los cálculos: no son del piloto.
const R1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const R2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const OFICIAL = 'aaaaaaaa-0000-4000-8000-000000000003';

const metricas = [
  {
    id_reporte: R1,
    es_oficial: 'false',
    creado_en: '2026-11-03T12:05:00Z',
    cerrado_en: '2026-11-03T14:00:00Z',
  },
  { id_reporte: R2, es_oficial: 'false', creado_en: '2026-11-04T09:00:00Z', cerrado_en: '' },
  { id_reporte: OFICIAL, es_oficial: 'true', creado_en: '2026-11-04T10:00:00Z', cerrado_en: '' },
];

const whatsapp = [
  // La plataforma lo mostró 5 minutos después.
  {
    publicado_en: '2026-11-03T08:00:00-04:00',
    cierto: 'si',
    id_reporte_plataforma: R1,
    dejo_de_ser_cierto_en: '',
    desmentido_en: '',
  },
  // La plataforma lo mostró 20 minutos antes; dejó de ser cierto y nadie lo desmintió.
  {
    publicado_en: '2026-11-04T05:20:00-04:00',
    cierto: 'si',
    id_reporte_plataforma: R2,
    dejo_de_ser_cierto_en: '2026-11-04T07:00:00-04:00',
    desmentido_en: '',
  },
  // Falso y desmentido a los 30 minutos.
  {
    publicado_en: '2026-11-05T10:00:00-04:00',
    cierto: 'no',
    id_reporte_plataforma: '',
    dejo_de_ser_cierto_en: '2026-11-05T10:00:00-04:00',
    desmentido_en: '2026-11-05T10:30:00-04:00',
  },
  {
    publicado_en: '2026-11-05T11:00:00-04:00',
    cierto: 'no_se_sabe',
    id_reporte_plataforma: '',
    dejo_de_ser_cierto_en: '',
    desmentido_en: '',
  },
];

const verificacion = [
  // Dejó de ser cierto a las 13:00 UTC y se cerró a las 14:00: 60 minutos visible.
  { id_reporte: R1, cierto: 'si', dejo_de_ser_cierto_en: '2026-11-03T13:00:00Z' },
  { id_reporte: R2, cierto: 'no', dejo_de_ser_cierto_en: '' },
  { id_reporte: OFICIAL, cierto: 'si', dejo_de_ser_cierto_en: '' },
];

const FIN = '2026-11-30T23:59:59-04:00';

describe('análisis del piloto (Fase 13)', () => {
  it('lee CSV de hoja de cálculo: comillas, comas dentro, CRLF y líneas vacías', () => {
    const texto = 'a,b,notas\r\n1,2,"Av. 6 de Agosto, esquina ""Aspiazu"""\r\n\r\n3,,x';

    expect(leerCsv(texto)).toEqual([
      { a: '1', b: '2', notas: 'Av. 6 de Agosto, esquina "Aspiazu"' },
      { a: '3', b: '', notas: 'x' },
    ]);
    expect(leerCsv('')).toEqual([]);
  });

  it('calcula la mediana y no la inventa sin datos', () => {
    expect(mediana([30, 10, 20])).toBe(20);
    expect(mediana([40, 10, 30, 20])).toBe(20);
    expect(mediana([])).toBeNull();
  });

  it('indicador 1: minutos entre el grupo y la plataforma, solo de los emparejados', () => {
    expect(tiempoDeAparicion(whatsapp, metricas)).toEqual({
      incidentesDelGrupo: 4,
      emparejados: 2,
      plataformaAntes: 1,
      medianaMinutos: -20,
    });
  });

  it('indicador 2: solo cuenta lo que se pudo comprobar', () => {
    expect(porcentajeDeCiertos(whatsapp)).toEqual({
      total: 4,
      comprobados: 3,
      ciertos: 2,
      porcentaje: 66.7,
    });
    expect(porcentajeDeCiertos([]).porcentaje).toBeNull();
  });

  it('indicador 3: lo que nunca se corrigió cuenta hasta el fin del piloto', () => {
    const fin = Date.parse('2026-11-04T12:00:00-04:00');

    expect(
      tiempoVisibleSinSerCierto(
        whatsapp,
        (w: { desmentido_en: string }) => (w.desmentido_en ? Date.parse(w.desmentido_en) : null),
        fin,
      ),
    ).toEqual({ casos: 2, sinCorregir: 1, medianaMinutos: 30 });
  });

  it('compara los tres indicadores sin contar los incidentes oficiales', () => {
    const r = analizar({ metricas, whatsapp, verificacion, fin: FIN });

    expect(r.ciertos.plataforma).toMatchObject({ total: 2, ciertos: 1, porcentaje: 50 });
    expect(r.visibleSinSerCierto.plataforma).toEqual({
      casos: 1,
      sinCorregir: 0,
      medianaMinutos: 60,
    });
    expect(r.visibleSinSerCierto.whatsapp.sinCorregir).toBe(1);
  });

  it('escribe el informe con coma decimal y «sin datos» donde no los hay', () => {
    const informe = aMarkdown(analizar({ metricas, whatsapp, verificacion, fin: FIN }), FIN);

    expect(informe).toContain('| La plataforma lo mostró antes | 1 de 2 |');
    expect(informe).toContain('66,7 %');
    expect(
      aMarkdown(analizar({ metricas: [], whatsapp: [], verificacion: [], fin: FIN }), FIN),
    ).toContain('sin datos');
  });

  it('rechaza una fecha mal escrita en las planillas', () => {
    const malo = [{ ...whatsapp[0], publicado_en: '3/11/2026 8:00' }];

    expect(() => tiempoDeAparicion(malo, metricas)).toThrow(/Fecha inválida/);
  });
});
