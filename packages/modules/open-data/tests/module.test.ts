import { describe, expect, it } from 'vitest';
import { openDataModule } from '../index.js';

describe('módulo open-data', () => {
  it('expone su nombre', () => {
    expect(openDataModule.name).toBe('open-data');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => openDataModule.register({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
