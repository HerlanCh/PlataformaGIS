import { describe, expect, it } from 'vitest';
import { verificationModule } from '../index.js';

describe('módulo verification', () => {
  it('expone su nombre', () => {
    expect(verificationModule.name).toBe('verification');
  });

  it('se registra sin errores', async () => {
    const registrar = async () =>
      verificationModule.register({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
