import { idUsuario } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import {
  ErrorHashDeDispositivoInvalido,
  ErrorIdTelegramInvalido,
  ErrorTelegramYaVinculado,
} from '../domain/errors.js';
import { Usuario } from '../domain/user.js';

const id = idUsuario('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f');
const hashDispositivo = 'a3f1c2d4e5b6978812345678';
const ahora = new Date('2026-10-11T12:00:00Z');

const registrar = (extra: { idTelegram?: string } = {}) =>
  Usuario.registrarDispositivo({ id, hashDispositivo, ahora, ...extra });

describe('Usuario', () => {
  it('HU-01: un dispositivo nuevo se registra como ciudadano anónimo', () => {
    const usuario = registrar();

    expect(usuario).toMatchObject({
      id,
      hashDispositivo,
      rol: 'CIUDADANO',
      idTelegram: null,
      creadoEn: ahora,
      esModerador: false,
    });
  });

  it.each(['', 'corto', 'con espacios en el hash 123', 'a'.repeat(129)])(
    'rechaza el hash de dispositivo "%s"',
    (hash) => {
      expect(() => Usuario.registrarDispositivo({ id, hashDispositivo: hash, ahora })).toThrow(
        ErrorHashDeDispositivoInvalido,
      );
    },
  );

  it('HU-09: se puede registrar con su cuenta de Telegram', () => {
    expect(registrar({ idTelegram: '123456789' }).idTelegram).toBe('123456789');
  });

  it('HU-09: vincula Telegram después del registro', () => {
    const usuario = registrar();

    usuario.vincularTelegram('123456789');

    expect(usuario.idTelegram).toBe('123456789');
  });

  it('volver a vincular el mismo Telegram no tiene efecto', () => {
    const usuario = registrar({ idTelegram: '123456789' });

    expect(() => usuario.vincularTelegram('123456789')).not.toThrow();
  });

  it('no permite cambiar a otra cuenta de Telegram', () => {
    const usuario = registrar({ idTelegram: '123456789' });

    expect(() => usuario.vincularTelegram('987654321')).toThrow(ErrorTelegramYaVinculado);
  });

  it.each(['', 'abc', '-5', '1'.repeat(21)])('rechaza el Telegram ID "%s"', (idTelegram) => {
    expect(() => registrar({ idTelegram })).toThrow(ErrorIdTelegramInvalido);
    expect(() => registrar().vincularTelegram(idTelegram)).toThrow(ErrorIdTelegramInvalido);
  });

  it('HU-12: un usuario puede ser promovido a moderador', () => {
    const usuario = registrar();

    usuario.ascenderAModerador();

    expect(usuario).toMatchObject({ rol: 'MODERADOR', esModerador: true });
  });

  it('se reconstruye desde sus datos persistidos', () => {
    const usuario = Usuario.restaurar({
      id,
      hashDispositivo,
      rol: 'MODERADOR',
      idTelegram: '42',
      creadoEn: ahora,
    });

    expect(usuario).toMatchObject({ rol: 'MODERADOR', idTelegram: '42' });
  });
});
