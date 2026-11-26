import { describe, expect, it } from 'vitest';
import type { EnvioDato, TransicionDato, VotoDato } from './datos.js';
import { PARAMETROS_DEL_SRS, simular } from './simulador.js';

const id = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;
const MIN = 60_000;
const cero = Date.parse('2026-11-22T12:00:00.000Z');
const en = (minuto: number) => cero + minuto * MIN;
const categorias = new Map([
  ['bloqueo', { ttlMinutos: 360, radioDuplicadoM: 100 }],
  ['infraestructura', { ttlMinutos: 1440, radioDuplicadoM: 50 }],
]);
/** Unos 11 m al norte por cada unidad. */
const envio = (
  n: number,
  minuto: number,
  norte = 0,
  cambios: Partial<EnvioDato> = {},
): EnvioDato => ({
  idEnvio: id(n),
  tipo: 'CREADO',
  idReporte: id(n),
  codigoCategoria: 'bloqueo',
  latitud: -16.5 + norte * 0.0001,
  longitud: -68.15,
  fuenteOficial: null,
  recibidoEn: en(minuto),
  ...cambios,
});
const voto = (
  reporte: number,
  minuto: number,
  valor: VotoDato['valor'] = 'CONFIRMACION',
  peso = 1,
): VotoDato => ({
  idReporte: id(reporte),
  valor,
  peso,
  decision: 'NINGUNA',
  ocurridoEn: en(minuto),
});
const estados = (transiciones: readonly TransicionDato[], reporte: number) =>
  transiciones
    .filter((t) => t.idReporte === id(reporte))
    .map((t) => [
      t.estado,
      t.caducaEn === null ? null : (t.caducaEn - cero) / MIN,
      (t.ocurridoEn - cero) / MIN,
    ]);

const correr = (
  datos: { envios?: EnvioDato[]; votos?: VotoDato[]; transiciones?: TransicionDato[] },
  parametros = PARAMETROS_DEL_SRS,
) => simular({ envios: [], votos: [], transiciones: [], ...datos }, categorias, parametros);

describe('simulador de sensibilidad (ADR-007)', () => {
  it('HU-14: con los parámetros del SRS confirma con 3,0 de 2 votantes, extiende con 6,0 y caduca al vencer', () => {
    const votos = [
      voto(1, 10),
      voto(1, 20),
      voto(1, 30),
      voto(1, 40),
      voto(1, 50),
      voto(1, 60),
      voto(1, 70),
    ];

    const { transiciones } = correr({ envios: [envio(1, 0)], votos });

    // TTL 360: confirmar y extender suman 180 cada uno; con dos extensiones no hay una tercera.
    expect(estados(transiciones, 1)).toEqual([
      ['ACTIVO', 360, 0],
      ['CONFIRMADO', 540, 30],
      ['CONFIRMADO', 720, 60],
    ]);
  });

  it('HU-14: un duplicado real queda absorbido sin voto propio; uno que solo aquí es duplicado suma peso 1', () => {
    const datos = {
      envios: [
        envio(1, 0),
        envio(2, 5, 3, { tipo: 'DUPLICADO', idReporte: id(1) }),
        envio(3, 6, 4),
      ],
      votos: [voto(1, 5, 'CONFIRMACION', 1.4)],
    };

    const conSrs = correr(datos);
    const conRadioMayor = correr(
      { ...datos, envios: [envio(1, 0), datos.envios[1]!, envio(3, 6, 20)] },
      { ...PARAMETROS_DEL_SRS, factorDeRadio: 1.5 },
    );

    expect(conSrs.envios.map((e) => e.idReporte)).toEqual([id(1), id(1), id(1)]);
    // 1,4 del duplicado real + 1 del envío 3, de 2 votantes: 2,4 no alcanza 3,0.
    expect(estados(conSrs.transiciones, 1)).toEqual([['ACTIVO', 360, 0]]);
    // A ~220 m, el envío 3 solo es duplicado con el radio de 150 m... y no llega: queda aparte.
    expect(conRadioMayor.envios.map((e) => e.idReporte)).toEqual([id(1), id(1), id(3)]);
  });

  it('HU-14: un umbral de 2,0 confirma antes y un radio de 0,5 separa lo que el SRS fusiona', () => {
    const datos = { envios: [envio(1, 0), envio(2, 5, 6)], votos: [voto(1, 10), voto(1, 20)] };

    const umbralBajo = correr(datos, { ...PARAMETROS_DEL_SRS, umbralDeConfirmacion: 2 });
    const radioMenor = correr(datos, { ...PARAMETROS_DEL_SRS, factorDeRadio: 0.5 });

    expect(estados(umbralBajo.transiciones, 1).map(([estado]) => estado)).toEqual([
      'ACTIVO',
      'CONFIRMADO',
    ]);
    expect(radioMenor.envios.map((e) => e.idReporte)).toEqual([id(1), id(2)]);
  });

  it('HU-14: las negaciones resuelven, el rechazo de moderación se respeta y un oficial no se deduplica', () => {
    const datos = {
      envios: [
        envio(1, 0),
        envio(2, 0, 50),
        envio(3, 1, 50, { codigoCategoria: 'infraestructura', fuenteOficial: 'TRANSITO' }),
        envio(4, 2, 50, { codigoCategoria: 'infraestructura', fuenteOficial: 'ABC' }),
      ],
      votos: [voto(1, 10, 'NEGACION', 1.5), voto(1, 11, 'NEGACION', 1.5), voto(2, 30)],
      transiciones: [{ idReporte: id(2), estado: 'RECHAZADO', caducaEn: null, ocurridoEn: en(20) }],
    };

    const { transiciones, envios } = correr(datos);

    expect(estados(transiciones, 1).at(-1)).toEqual(['RESUELTO', null, 11]);
    expect(estados(transiciones, 2)).toEqual([
      ['ACTIVO', 360, 0],
      ['RECHAZADO', null, 20],
    ]);
    expect(envios.map((e) => e.idReporte).slice(2)).toEqual([id(3), id(4)]);
  });

  it('HU-14: un TTL de 0,5 caduca antes y el voto que llega después ya no cuenta', () => {
    const datos = { envios: [envio(1, 0)], votos: [voto(1, 200), voto(1, 210), voto(1, 220)] };

    const { transiciones } = correr(datos, { ...PARAMETROS_DEL_SRS, factorDeTtl: 0.5 });

    expect(estados(transiciones, 1)).toEqual([
      ['ACTIVO', 180, 0],
      ['CADUCADO', null, 180],
    ]);
  });
});
