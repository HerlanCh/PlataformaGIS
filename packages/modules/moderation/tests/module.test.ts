import { describe, expect, it } from 'vitest';
import { moderationModulo } from '../index.js';

describe('módulo moderation', () => {
  it('expone su nombre', () => {
    expect(moderationModulo.nombre).toBe('moderation');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => moderationModulo.registrar({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
