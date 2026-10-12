import { describe, expect, it } from 'vitest';
import { heatmapModulo } from '../index.js';

describe('módulo heatmap', () => {
  it('expone su nombre', () => {
    expect(heatmapModulo.nombre).toBe('heatmap');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => heatmapModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
