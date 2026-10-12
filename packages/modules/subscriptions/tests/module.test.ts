import { describe, expect, it } from 'vitest';
import { subscriptionsModulo } from '../index.js';

describe('módulo subscriptions', () => {
  it('expone su nombre', () => {
    expect(subscriptionsModulo.nombre).toBe('subscriptions');
  });

  it('se registra sin errores', async () => {
    const registrar = async () =>
      subscriptionsModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
