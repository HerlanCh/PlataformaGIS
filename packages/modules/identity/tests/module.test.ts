import { describe, expect, it } from 'vitest';
import { identityModulo } from '../index.js';

describe('módulo identity', () => {
  it('expone su nombre', () => {
    expect(identityModulo.nombre).toBe('identity');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => identityModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
