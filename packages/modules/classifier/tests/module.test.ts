import { describe, expect, it } from 'vitest';
import { classifierModulo } from '../index.js';

describe('módulo classifier', () => {
  it('expone su nombre', () => {
    expect(classifierModulo.nombre).toBe('classifier');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => classifierModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
