import { describe, expect, it } from 'vitest';
import { metricsModulo } from '../index.js';

describe('módulo metrics', () => {
  it('expone su nombre', () => {
    expect(metricsModulo.nombre).toBe('metrics');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => metricsModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
