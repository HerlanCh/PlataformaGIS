import { describe, expect, it } from 'vitest';
import { subscriptionsModule } from '../index.js';

describe('módulo subscriptions', () => {
  it('expone su nombre', () => {
    expect(subscriptionsModule.name).toBe('subscriptions');
  });

  it('se registra sin errores', async () => {
    const registrar = async () =>
      subscriptionsModule.register({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
