import { describe, expect, it } from 'vitest';
import { reportsModule } from '../index.js';

describe('módulo reports', () => {
  it('expone su nombre', () => {
    expect(reportsModule.name).toBe('reports');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => reportsModule.register({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
