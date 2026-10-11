import { describe, expect, it } from 'vitest';
import { heatmapModule } from '../index.js';

describe('módulo heatmap', () => {
  it('expone su nombre', () => {
    expect(heatmapModule.name).toBe('heatmap');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => heatmapModule.register({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
