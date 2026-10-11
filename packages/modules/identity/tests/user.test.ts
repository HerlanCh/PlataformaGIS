import { userId } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import {
  InvalidDeviceHashError,
  InvalidTelegramIdError,
  TelegramAlreadyLinkedError,
} from '../domain/errors.js';
import { User } from '../domain/user.js';

const id = userId('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f');
const deviceHash = 'a3f1c2d4e5b6978812345678';
const now = new Date('2026-10-11T12:00:00Z');

const registrar = (extra: { telegramId?: string } = {}) =>
  User.registerDevice({ id, deviceHash, now, ...extra });

describe('User', () => {
  it('HU-01: un dispositivo nuevo se registra como ciudadano anónimo', () => {
    const usuario = registrar();

    expect(usuario).toMatchObject({
      id,
      deviceHash,
      role: 'CIUDADANO',
      telegramId: null,
      createdAt: now,
      isModerator: false,
    });
  });

  it.each(['', 'corto', 'con espacios en el hash 123', 'a'.repeat(129)])(
    'rechaza el hash de dispositivo "%s"',
    (hash) => {
      expect(() => User.registerDevice({ id, deviceHash: hash, now })).toThrow(
        InvalidDeviceHashError,
      );
    },
  );

  it('HU-09: se puede registrar con su cuenta de Telegram', () => {
    expect(registrar({ telegramId: '123456789' }).telegramId).toBe('123456789');
  });

  it('HU-09: vincula Telegram después del registro', () => {
    const usuario = registrar();

    usuario.linkTelegram('123456789');

    expect(usuario.telegramId).toBe('123456789');
  });

  it('volver a vincular el mismo Telegram no tiene efecto', () => {
    const usuario = registrar({ telegramId: '123456789' });

    expect(() => usuario.linkTelegram('123456789')).not.toThrow();
  });

  it('no permite cambiar a otra cuenta de Telegram', () => {
    const usuario = registrar({ telegramId: '123456789' });

    expect(() => usuario.linkTelegram('987654321')).toThrow(TelegramAlreadyLinkedError);
  });

  it.each(['', 'abc', '-5', '1'.repeat(21)])('rechaza el Telegram ID "%s"', (telegramId) => {
    expect(() => registrar({ telegramId })).toThrow(InvalidTelegramIdError);
    expect(() => registrar().linkTelegram(telegramId)).toThrow(InvalidTelegramIdError);
  });

  it('HU-12: un usuario puede ser promovido a moderador', () => {
    const usuario = registrar();

    usuario.promoteToModerator();

    expect(usuario).toMatchObject({ role: 'MODERADOR', isModerator: true });
  });

  it('se reconstruye desde sus datos persistidos', () => {
    const usuario = User.restore({
      id,
      deviceHash,
      role: 'MODERADOR',
      telegramId: '42',
      createdAt: now,
    });

    expect(usuario).toMatchObject({ role: 'MODERADOR', telegramId: '42' });
  });
});
