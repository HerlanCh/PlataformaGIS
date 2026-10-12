import { describe, expect, it } from 'vitest';
import { notificationsModulo } from '../index.js';

describe('módulo notifications', () => {
  it('expone su nombre', () => {
    expect(notificationsModulo.nombre).toBe('notifications');
  });

  it('se registra sin errores', async () => {
    const registrar = async () =>
      notificationsModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
