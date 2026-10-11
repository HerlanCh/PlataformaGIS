import { describe, expect, it } from 'vitest';
import { classifierModule } from '../index.js';

describe('módulo classifier', () => {
  it('expone su nombre', () => {
    expect(classifierModule.name).toBe('classifier');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => classifierModule.register({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
