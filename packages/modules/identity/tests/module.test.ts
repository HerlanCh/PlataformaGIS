import { describe, expect, it } from 'vitest';
import { identityModule } from '../index.js';

describe('módulo identity', () => {
  it('expone su nombre', () => {
    expect(identityModule.name).toBe('identity');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => identityModule.register({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
