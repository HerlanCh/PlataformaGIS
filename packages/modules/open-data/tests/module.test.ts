import { describe, expect, it } from 'vitest';
import { openDataModulo } from '../index.js';

describe('módulo open-data', () => {
  it('expone su nombre', () => {
    expect(openDataModulo.nombre).toBe('open-data');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => openDataModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
