import { describe, expect, it } from 'vitest';
import {
  AlreadyVotedError,
  AuthorCannotVoteError,
  ReportNotActiveError,
  TooFarToVoteError,
} from '../domain/errors.js';
import { MAX_VOTE_DISTANCE_M, Vote } from '../domain/vote.js';
import type { CastVoteInput } from '../domain/vote.js';
import { ahora, aMetros, AUTOR, ID_REPORTE, reporte, reputacion, usuario } from './fixtures.js';

const votante = usuario(1);

const emitir = (cambios: Partial<CastVoteInput> = {}) =>
  Vote.cast({
    report: reporte(),
    voter: reputacion(votante, 1.0),
    voterLocation: aMetros(100),
    value: 'CONFIRMACION',
    alreadyVoted: false,
    now: ahora,
    ...cambios,
  });

describe('Vote', () => {
  it('HU-03: registra el voto con el peso de la reputación del votante', () => {
    const voto = emitir({ voter: reputacion(votante, 2.35) });

    expect(voto).toMatchObject({
      reportId: ID_REPORTE,
      voterId: votante,
      value: 'CONFIRMACION',
      weight: 2.35,
      castAt: ahora,
    });
  });

  it('HU-03: se puede negar un reporte ya confirmado', () => {
    const voto = emitir({ report: reporte({ status: 'CONFIRMADO' }), value: 'NEGACION' });

    expect(voto.value).toBe('NEGACION');
  });

  it('HU-03: el autor no puede votar su propio reporte', () => {
    expect(() => emitir({ voter: reputacion(AUTOR) })).toThrow(AuthorCannotVoteError);
  });

  it('HU-03: rechaza un voto repetido', () => {
    expect(() => emitir({ alreadyVoted: true })).toThrow(AlreadyVotedError);
  });

  it('HU-03: rechaza el voto de un usuario a más de 1000 m', () => {
    expect(() => emitir({ voterLocation: aMetros(1010) })).toThrow(TooFarToVoteError);
    expect(() => emitir({ voterLocation: aMetros(1010) })).toThrow(`${MAX_VOTE_DISTANCE_M} m`);
  });

  it('HU-03: acepta el voto de un usuario a menos de 1000 m', () => {
    expect(() => emitir({ voterLocation: aMetros(990) })).not.toThrow();
  });

  it.each(['RESUELTO', 'CADUCADO', 'RECHAZADO'] as const)(
    'no se puede votar un reporte %s',
    (status) => {
      expect(() => emitir({ report: reporte({ status }) })).toThrow(ReportNotActiveError);
    },
  );

  it('el voto de un usuario silenciado se registra con peso 0', () => {
    expect(emitir({ voter: reputacion(votante, 0) }).weight).toBe(0);
  });

  it('es inmutable', () => {
    const voto = emitir();

    expect(() => {
      (voto as { weight: number }).weight = 5;
    }).toThrow(TypeError);
  });
});
