import { describe, expect, it } from 'vitest';
import { notificationsModule } from '../index.js';

describe('módulo notifications', () => {
  it('expone su nombre', () => {
    expect(notificationsModule.name).toBe('notifications');
  });

  it('se registra sin errores', async () => {
    const registrar = async () =>
      notificationsModule.register({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
