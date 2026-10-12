import { describe, expect, it } from 'vitest';
import { verificationModulo } from '../index.js';

describe('módulo verification', () => {
  it('expone su nombre', () => {
    expect(verificationModulo.nombre).toBe('verification');
  });

  it('se registra sin errores', async () => {
    const registrar = async () =>
      verificationModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
