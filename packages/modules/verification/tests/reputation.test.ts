import { describe, expect, it } from 'vitest';
import { Reputation, REPUTATION } from '../domain/reputation.js';
import { REPUTATION_ADJUSTMENTS, ReputationPolicy } from '../domain/reputation-policy.js';
import { ahora, diasDespues, reputacion, usuario, voto } from './fixtures.js';

const alguien = usuario(1);

describe('Reputation', () => {
  it('todo usuario nuevo empieza con reputación 1.0', () => {
    expect(Reputation.initial(alguien)).toMatchObject({
      userId: alguien,
      score: 1.0,
      lastPenaltyAt: null,
      isSilenced: false,
    });
  });

  it('HU-03: el autor de un reporte confirmado gana 0.20', () => {
    const autor = Reputation.initial(alguien);

    autor.reward(REPUTATION_ADJUSTMENTS.reportConfirmed);

    expect(autor.score).toBe(1.2);
  });

  it('HU-03: un voto acertado suma 0.05 sin acumular error de coma flotante', () => {
    const votante = Reputation.initial(alguien);

    for (let i = 0; i < 3; i += 1) votante.reward(REPUTATION_ADJUSTMENTS.accurateVote);

    expect(votante.score).toBe(1.15);
  });

  it('la reputación no supera 5.0', () => {
    const veterano = reputacion(alguien, 4.9);

    veterano.reward(0.2);

    expect(veterano.score).toBe(REPUTATION.max);
  });

  it('HU-12: un rechazo por moderación resta 0.50 y anota la fecha', () => {
    const autor = Reputation.initial(alguien);

    autor.penalize(ReputationPolicy.penaltyForRejection('MODERACION'), ahora);

    expect(autor).toMatchObject({ score: 0.5, lastPenaltyAt: ahora, isSilenced: false });
  });

  it('HU-12: dos rechazos silencian a un usuario nuevo', () => {
    const autor = Reputation.initial(alguien);

    autor.penalize(0.5, ahora);
    autor.penalize(0.5, ahora);

    expect(autor).toMatchObject({ score: 0, isSilenced: true });
  });

  it('la reputación no baja de 0.0', () => {
    const autor = reputacion(alguien, 0.2);

    autor.penalize(0.5, ahora);

    expect(autor.score).toBe(REPUTATION.min);
  });

  it('el rechazo automático por autor silenciado no penaliza de nuevo', () => {
    expect(ReputationPolicy.penaltyForRejection('AUTOR_SILENCIADO')).toBe(0);
  });

  it('un usuario silenciado no gana reputación por aciertos', () => {
    const silenciado = reputacion(alguien, 0);

    silenciado.reward(0.2);

    expect(silenciado).toMatchObject({ score: 0, isSilenced: true });
  });
});

describe('Reputation: recuperación de un usuario silenciado', () => {
  const silenciado = () => Reputation.restore({ userId: alguien, score: 0, lastPenaltyAt: ahora });

  it('vuelve a 0.5 a los 30 días de su última penalización', () => {
    const usuarioSilenciado = silenciado();

    expect(usuarioSilenciado.recoverIfDue(diasDespues(30))).toBe(true);
    expect(usuarioSilenciado).toMatchObject({ score: 0.5, isSilenced: false });
  });

  it('a los 29 días sigue silenciado', () => {
    const usuarioSilenciado = silenciado();

    expect(usuarioSilenciado.recoverIfDue(diasDespues(29))).toBe(false);
    expect(usuarioSilenciado.isSilenced).toBe(true);
  });

  it('una nueva penalización reinicia el plazo', () => {
    const usuarioSilenciado = silenciado();
    usuarioSilenciado.penalize(0.5, diasDespues(20));

    expect(usuarioSilenciado.recoverIfDue(diasDespues(40))).toBe(false);
    expect(usuarioSilenciado.recoverIfDue(diasDespues(50))).toBe(true);
  });

  it('no afecta a quien no está silenciado', () => {
    const penalizado = Reputation.restore({ userId: alguien, score: 0.5, lastPenaltyAt: ahora });

    expect(penalizado.recoverIfDue(diasDespues(60))).toBe(false);
    expect(penalizado.score).toBe(0.5);
  });

  it('no recupera a un silenciado sin fecha de penalización registrada', () => {
    expect(reputacion(alguien, 0).recoverIfDue(diasDespues(60))).toBe(false);
  });
});

describe('ReputationPolicy: votos acertados', () => {
  const votos = [
    voto(1, 'CONFIRMACION'),
    voto(2, 'CONFIRMACION'),
    voto(3, 'NEGACION'),
    voto(4, 'CONFIRMACION', 0), // silenciado
    voto(5, 'NEGACION', 0), // silenciado
  ];

  it('HU-03: si el reporte se confirma, aciertan quienes confirmaron', () => {
    expect(ReputationPolicy.accurateVoters(votos, 'CONFIRMADO')).toEqual([usuario(1), usuario(2)]);
  });

  it('HU-03: si el reporte se resuelve, aciertan quienes negaron', () => {
    expect(ReputationPolicy.accurateVoters(votos, 'RESUELTO')).toEqual([usuario(3)]);
  });
});
