import { describe, expect, it } from 'vitest';
import { reportsModulo } from '../index.js';

describe('módulo reports', () => {
  it('expone su nombre', () => {
    expect(reportsModulo.nombre).toBe('reports');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => reportsModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
