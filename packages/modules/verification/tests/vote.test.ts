import { describe, expect, it } from 'vitest';
import {
  ErrorYaVoto,
  ErrorAutorNoPuedeVotar,
  ErrorReporteNoActivo,
  ErrorDemasiadoLejosParaVotar,
} from '../domain/errors.js';
import { DISTANCIA_MAX_VOTO_M, Voto } from '../domain/vote.js';
import type { EntradaEmitirVoto } from '../domain/vote.js';
import { ahora, aMetros, AUTOR, ID_REPORTE, reporte, reputacion, usuario } from './fixtures.js';

const votante = usuario(1);

const emitir = (cambios: Partial<EntradaEmitirVoto> = {}) =>
  Voto.emitir({
    reporte: reporte(),
    votante: reputacion(votante, 1.0),
    ubicacionVotante: aMetros(100),
    valor: 'CONFIRMACION',
    yaVoto: false,
    ahora: ahora,
    ...cambios,
  });

describe('Voto', () => {
  it('HU-03: registra el voto con el peso de la reputación del votante', () => {
    const voto = emitir({ votante: reputacion(votante, 2.35) });

    expect(voto).toMatchObject({
      idReporte: ID_REPORTE,
      idVotante: votante,
      valor: 'CONFIRMACION',
      peso: 2.35,
      emitidoEn: ahora,
    });
  });

  it('HU-03: se puede negar un reporte ya confirmado', () => {
    const voto = emitir({ reporte: reporte({ estado: 'CONFIRMADO' }), valor: 'NEGACION' });

    expect(voto.valor).toBe('NEGACION');
  });

  it('HU-03: el autor no puede votar su propio reporte', () => {
    expect(() => emitir({ votante: reputacion(AUTOR) })).toThrow(ErrorAutorNoPuedeVotar);
  });

  it('HU-03: rechaza un voto repetido', () => {
    expect(() => emitir({ yaVoto: true })).toThrow(ErrorYaVoto);
  });

  it('HU-03: rechaza el voto de un usuario a más de 1000 m', () => {
    expect(() => emitir({ ubicacionVotante: aMetros(1010) })).toThrow(ErrorDemasiadoLejosParaVotar);
    expect(() => emitir({ ubicacionVotante: aMetros(1010) })).toThrow(`${DISTANCIA_MAX_VOTO_M} m`);
  });

  it('HU-03: acepta el voto de un usuario a menos de 1000 m', () => {
    expect(() => emitir({ ubicacionVotante: aMetros(990) })).not.toThrow();
  });

  it.each(['RESUELTO', 'CADUCADO', 'RECHAZADO'] as const)(
    'no se puede votar un reporte %s',
    (status) => {
      expect(() => emitir({ reporte: reporte({ estado: status }) })).toThrow(ErrorReporteNoActivo);
    },
  );

  it('el voto de un usuario silenciado se registra con peso 0', () => {
    expect(emitir({ votante: reputacion(votante, 0) }).peso).toBe(0);
  });

  it('es inmutable', () => {
    const voto = emitir();

    expect(() => {
      (voto as { peso: number }).peso = 5;
    }).toThrow(TypeError);
  });
});
