import { describe, expect, it } from 'vitest';
import { moderationModule } from '../index.js';

describe('módulo moderation', () => {
  it('expone su nombre', () => {
    expect(moderationModule.name).toBe('moderation');
  });

  it('se registra sin errores', async () => {
    const registrar = async () => moderationModule.register({} as never, {} as never, {} as never);

    await expect(registrar()).resolves.toBeUndefined();
  });
});
