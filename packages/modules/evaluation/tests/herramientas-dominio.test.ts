import { describe, expect, it } from 'vitest';
import { kappaDeCohen, medirAcuerdo, paresCandidatos } from '../domain/etiquetado.js';
import type { EnvioEtiquetable, Etiqueta } from '../domain/etiquetado.js';
import { avisosDeEscenarios } from '../domain/instantanea.js';
import {
  cerrarTarea,
  CODIGO_DE_PARTICIPANTE,
  DURACION_DE_TAREA_MS,
  SECUENCIAS,
  secuenciaEquilibrada,
} from '../domain/tarea.js';
import { sortear } from '../domain/verificacion.js';
import type { ReporteVerificable } from '../domain/verificacion.js';

const id = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;
const cero = new Date('2026-11-22T12:00:00.000Z');
const minutos = (n: number) => new Date(cero.getTime() + n * 60_000);
/** Unos 11 m por cada 0,0001° de latitud. */
const punto = (norte = 0) => ({ latitud: -16.5 + norte * 0.0001, longitud: -68.15 });

describe('secuencias de la tarea cronometrada', () => {
  it('HU-14: cada secuencia muestra las dos vistas y los dos escenarios, y el orden se alterna', () => {
    for (const [primera, segunda] of Object.values(SECUENCIAS)) {
      expect(new Set([primera.vista, segunda.vista])).toEqual(new Set(['BASE', 'PROCESADA']));
      expect(new Set([primera.escenario, segunda.escenario])).toEqual(new Set(['E1', 'E2']));
    }
    const primeras = Object.values(SECUENCIAS).map(([p]) => `${p.vista}-${p.escenario}`);
    expect(new Set(primeras).size).toBe(4);
  });

  it('HU-14: el código de participante es anónimo', () => {
    expect(['P01', 'P112'].every((c) => CODIGO_DE_PARTICIPANTE.test(c))).toBe(true);
    expect(['Ana', 'P1', 'P1234', 'p01'].some((c) => CODIGO_DE_PARTICIPANTE.test(c))).toBe(false);
  });
});

describe('cerrarTarea', () => {
  const puntos = new Set([id(1), id(2), id(3)]);

  it('HU-14: mide el tiempo en el servidor y guarda una marca por punto, la primera', () => {
    const cierre = cerrarTarea(
      cero,
      new Date(cero.getTime() + 95_000),
      [
        { idPunto: id(2), msDesdeInicio: 40_000 },
        { idPunto: id(1), msDesdeInicio: 10_000 },
        { idPunto: id(2), msDesdeInicio: 20_000 },
      ],
      puntos,
    );

    expect(cierre).toEqual({
      terminadaEn: new Date(cero.getTime() + 95_000),
      duracionMs: 95_000,
      agotada: false,
      marcas: [
        { idPunto: id(1), msDesdeInicio: 10_000 },
        { idPunto: id(2), msDesdeInicio: 20_000 },
      ],
    });
  });

  it('HU-14: con el tiempo agotado limita la duración a 180 s y descarta lo posterior o ajeno a la vista', () => {
    const cierre = cerrarTarea(
      cero,
      new Date(cero.getTime() + 200_000),
      [
        { idPunto: id(3), msDesdeInicio: 179_000 },
        { idPunto: id(1), msDesdeInicio: 185_000 },
        { idPunto: id(9), msDesdeInicio: 5_000 },
      ],
      puntos,
    );

    expect(cierre).toMatchObject({ duracionMs: DURACION_DE_TAREA_MS, agotada: true });
    expect(cierre.marcas).toEqual([{ idPunto: id(3), msDesdeInicio: 179_000 }]);
  });

  it('un reloj atrasado no da duraciones negativas', () => {
    expect(cerrarTarea(cero, minutos(-1), [], puntos).duracionMs).toBe(0);
  });
});

describe('kappa de Cohen', () => {
  it('HU-14: coincide con un ejemplo calculado a mano', () => {
    // po = 0,85; pe = 0,6·0,55 + 0,4·0,45 = 0,51; kappa = 0,34 / 0,49.
    const kappa = kappaDeCohen({ ambosSi: 50, soloA: 10, soloB: 5, ambosNo: 35 });

    expect(kappa).toBeCloseTo(0.34 / 0.49, 10);
  });

  it('es 1 con acuerdo total y nulo si no hay pares o no hay variación', () => {
    expect(kappaDeCohen({ ambosSi: 3, soloA: 0, soloB: 0, ambosNo: 4 })).toBe(1);
    expect(kappaDeCohen({ ambosSi: 0, soloA: 0, soloB: 0, ambosNo: 0 })).toBeNull();
    expect(kappaDeCohen({ ambosSi: 5, soloA: 0, soloB: 0, ambosNo: 0 })).toBeNull();
  });
});

describe('pares candidatos y acuerdo', () => {
  const radios = new Map([['bloqueo', 100]]);
  const envio = (
    n: number,
    en: number,
    norte = 0,
    codigoCategoria = 'bloqueo',
  ): EnvioEtiquetable => ({
    idEnvio: id(n),
    codigoCategoria,
    publicLocation: punto(norte),
    recibidoEn: minutos(en),
  });

  it('HU-14: son candidatos los de la misma categoría a ≤ 24 h y ≤ 3 radios', () => {
    const envios = [
      envio(1, 0),
      envio(2, 30, 20), // ~220 m: dentro de 300 m
      envio(3, 30, 40), // ~440 m: lejos de 1, cerca de 2
      envio(4, 2000), // más de 24 h después
      envio(5, 10, 0, 'robo'), // otra categoría y sin radio
    ];

    const pares = paresCandidatos(envios, radios).map(([a, b]) => [a.idEnvio, b.idEnvio]);

    expect(pares).toEqual([
      [id(1), id(2)],
      [id(2), id(3)],
    ]);
  });

  it('HU-14: mide el acuerdo solo sobre pares que ambos etiquetaron y lista los desacuerdos', () => {
    const envios = [envio(1, 0), envio(2, 5, 1), envio(3, 10, 2), envio(4, 15, 3)];
    const etiquetas: Etiqueta[] = [
      ...[1, 2, 3, 4].map((n) => ({
        evaluador: 'A' as const,
        idEnvio: id(n),
        grupo: n <= 2 ? 'x' : 'y',
      })),
      ...[1, 2, 3].map((n) => ({ evaluador: 'B' as const, idEnvio: id(n), grupo: 'x' })),
      { evaluador: 'CONSENSO', idEnvio: id(1), grupo: 'x' },
    ];

    const acuerdo = medirAcuerdo(envios, etiquetas, radios);

    // Pares 1-2 (ambos sí), 1-3 y 2-3 (solo B). El 4 no lo etiquetó B.
    expect(acuerdo).toMatchObject({ paresCandidatos: 6, paresEvaluados: 3 });
    expect(acuerdo.acuerdoObservado).toBeCloseTo(1 / 3, 10);
    expect(acuerdo.desacuerdos).toEqual([
      { idEnvioA: id(1), idEnvioB: id(3), mismoSegunA: false, mismoSegunB: true },
      { idEnvioA: id(2), idEnvioB: id(3), mismoSegunA: false, mismoSegunB: true },
    ]);
    expect(acuerdo.kappa).toBe(0);
  });

  it('sin etiquetas no hay acuerdo que medir', () => {
    expect(medirAcuerdo([envio(1, 0), envio(2, 1)], [], radios)).toMatchObject({
      kappa: null,
      paresEvaluados: 0,
      acuerdoObservado: null,
    });
  });
});

describe('sorteo de la verificación', () => {
  const reporte = (
    n: number,
    codigoCategoria: string,
    confirmado: boolean,
  ): ReporteVerificable => ({
    idReporte: id(n),
    codigoCategoria,
    publicLocation: punto(),
    creadoEn: minutos(n),
    confirmado,
  });

  it('HU-14: toma hasta 5 confirmados y 5 no confirmados por categoría, sin repetir', () => {
    const reportes = [
      ...Array.from({ length: 8 }, (_, i) => reporte(i, 'bloqueo', true)),
      ...Array.from({ length: 3 }, (_, i) => reporte(20 + i, 'bloqueo', false)),
      reporte(40, 'robo', true),
    ];
    let semilla = 0;
    const azar = () => (semilla = (semilla * 9301 + 49297) % 233280) / 233280;

    const { confirmados, noConfirmados } = sortear(reportes, azar);

    expect(confirmados.filter((r) => r.codigoCategoria === 'bloqueo')).toHaveLength(5);
    expect(confirmados.filter((r) => r.codigoCategoria === 'robo')).toHaveLength(1);
    expect(noConfirmados).toHaveLength(3);
    expect(new Set(confirmados.map((r) => r.idReporte)).size).toBe(confirmados.length);
    expect(
      confirmados.every((r) => r.confirmado) && noConfirmados.every((r) => !r.confirmado),
    ).toBe(true);
  });
});

describe('criterios del perfil v5 para E1 y E2 (6.3)', () => {
  it('HU-14: la secuencia sorteada sale de las que llevan menos sesiones', () => {
    expect(secuenciaEquilibrada([], () => 0.99)).toBe(4);
    expect(secuenciaEquilibrada([1, 2, 3], () => 0)).toBe(4);
    expect(secuenciaEquilibrada([1, 1, 2, 3, 4], () => 0.5)).toBe(3);
  });

  it('HU-14: avisa si falta un escenario, si la clave no tiene de 3 a 6 incidentes o si difieren más de 20 %', () => {
    const escenario = (incidentes: number, puntosBase: number) => ({
      clave: Array.from({ length: incidentes }, (_, i) => `g${i}`),
      puntosBase,
    });

    expect(avisosDeEscenarios(escenario(4, 20), escenario(5, 18))).toEqual([]);
    expect(avisosDeEscenarios(escenario(2, 20), undefined)).toEqual([
      'La clave de E1 tiene 2 incidentes; el perfil pide de 3 a 6.',
      'Falta congelar E2.',
    ]);
    expect(avisosDeEscenarios(escenario(3, 20), escenario(7, 10))).toEqual([
      'La clave de E2 tiene 7 incidentes; el perfil pide de 3 a 6.',
      'E1 y E2 difieren en un 50 % de reportes; el perfil pide 20 % o menos.',
    ]);
  });
});
