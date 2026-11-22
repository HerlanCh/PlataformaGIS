import { describe, expect, it } from 'vitest';
import { evaluationModulo } from '../index.js';

describe('módulo evaluation', () => {
  it('expone su nombre', () => {
    expect(evaluationModulo.nombre).toBe('evaluation');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => evaluationModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
