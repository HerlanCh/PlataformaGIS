import { describe, expect, it } from 'vitest';
import { Reputacion, REPUTACION } from '../domain/reputation.js';
import { AJUSTES_DE_REPUTACION, PoliticaDeReputacion } from '../domain/reputation-policy.js';
import { ahora, diasDespues, reputacion, usuario, voto } from './fixtures.js';

const alguien = usuario(1);

describe('Reputacion', () => {
  it('todo usuario nuevo empieza con reputación 1.0', () => {
    expect(Reputacion.inicial(alguien)).toMatchObject({
      idUsuario: alguien,
      puntaje: 1.0,
      ultimaPenalizacionEn: null,
      estaSilenciado: false,
    });
  });

  it('HU-03: el autor de un reporte confirmado gana 0.20', () => {
    const autor = Reputacion.inicial(alguien);

    autor.premiar(AJUSTES_DE_REPUTACION.reporteConfirmado);

    expect(autor.puntaje).toBe(1.2);
  });

  it('HU-03: un voto acertado suma 0.05 sin acumular error de coma flotante', () => {
    const votante = Reputacion.inicial(alguien);

    for (let i = 0; i < 3; i += 1) votante.premiar(AJUSTES_DE_REPUTACION.votoAcertado);

    expect(votante.puntaje).toBe(1.15);
  });

  it('la reputación no supera 5.0', () => {
    const veterano = reputacion(alguien, 4.9);

    veterano.premiar(0.2);

    expect(veterano.puntaje).toBe(REPUTACION.maximo);
  });

  it('HU-12: un rechazo por moderación resta 0.50 y anota la fecha', () => {
    const autor = Reputacion.inicial(alguien);

    autor.penalizar(PoliticaDeReputacion.penalizacionPorRechazo('MODERACION'), ahora);

    expect(autor).toMatchObject({
      puntaje: 0.5,
      ultimaPenalizacionEn: ahora,
      estaSilenciado: false,
    });
  });

  it('HU-12: dos rechazos silencian a un usuario nuevo', () => {
    const autor = Reputacion.inicial(alguien);

    autor.penalizar(0.5, ahora);
    autor.penalizar(0.5, ahora);

    expect(autor).toMatchObject({ puntaje: 0, estaSilenciado: true });
  });

  it('la reputación no baja de 0.0', () => {
    const autor = reputacion(alguien, 0.2);

    autor.penalizar(0.5, ahora);

    expect(autor.puntaje).toBe(REPUTACION.minimo);
  });

  it('el rechazo automático por autor silenciado no penaliza de nuevo', () => {
    expect(PoliticaDeReputacion.penalizacionPorRechazo('AUTOR_SILENCIADO')).toBe(0);
  });

  it('un usuario silenciado no gana reputación por aciertos', () => {
    const silenciado = reputacion(alguien, 0);

    silenciado.premiar(0.2);

    expect(silenciado).toMatchObject({ puntaje: 0, estaSilenciado: true });
  });
});

describe('Reputacion: recuperación de un usuario silenciado', () => {
  const silenciado = () =>
    Reputacion.restaurar({ idUsuario: alguien, puntaje: 0, ultimaPenalizacionEn: ahora });

  it('vuelve a 0.5 a los 30 días de su última penalización', () => {
    const usuarioSilenciado = silenciado();

    expect(usuarioSilenciado.recuperarSiCorresponde(diasDespues(30))).toBe(true);
    expect(usuarioSilenciado).toMatchObject({ puntaje: 0.5, estaSilenciado: false });
  });

  it('a los 29 días sigue silenciado', () => {
    const usuarioSilenciado = silenciado();

    expect(usuarioSilenciado.recuperarSiCorresponde(diasDespues(29))).toBe(false);
    expect(usuarioSilenciado.estaSilenciado).toBe(true);
  });

  it('una nueva penalización reinicia el plazo', () => {
    const usuarioSilenciado = silenciado();
    usuarioSilenciado.penalizar(0.5, diasDespues(20));

    expect(usuarioSilenciado.recuperarSiCorresponde(diasDespues(40))).toBe(false);
    expect(usuarioSilenciado.recuperarSiCorresponde(diasDespues(50))).toBe(true);
  });

  it('no afecta a quien no está silenciado', () => {
    const penalizado = Reputacion.restaurar({
      idUsuario: alguien,
      puntaje: 0.5,
      ultimaPenalizacionEn: ahora,
    });

    expect(penalizado.recuperarSiCorresponde(diasDespues(60))).toBe(false);
    expect(penalizado.puntaje).toBe(0.5);
  });

  it('no recupera a un silenciado sin fecha de penalización registrada', () => {
    expect(reputacion(alguien, 0).recuperarSiCorresponde(diasDespues(60))).toBe(false);
  });
});

describe('PoliticaDeReputacion: votos acertados', () => {
  const votos = [
    voto(1, 'CONFIRMACION'),
    voto(2, 'CONFIRMACION'),
    voto(3, 'NEGACION'),
    voto(4, 'CONFIRMACION', 0), // silenciado
    voto(5, 'NEGACION', 0), // silenciado
  ];

  it('HU-03: si el reporte se confirma, aciertan quienes confirmaron', () => {
    expect(PoliticaDeReputacion.votantesAcertados(votos, 'CONFIRMADO')).toEqual([
      usuario(1),
      usuario(2),
    ]);
  });

  it('HU-03: si el reporte se resuelve, aciertan quienes negaron', () => {
    expect(PoliticaDeReputacion.votantesAcertados(votos, 'RESUELTO')).toEqual([usuario(3)]);
  });
});
