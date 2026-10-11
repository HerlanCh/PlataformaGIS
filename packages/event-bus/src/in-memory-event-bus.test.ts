import type { IntegrationEvent } from '@gis/contracts';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryEventBus } from './index.js';

const evento = (type: string, version = 1): IntegrationEvent => ({
  id: '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f',
  type,
  version,
  occurredAt: '2026-10-11T12:00:00Z',
  payload: {},
});

describe('InMemoryEventBus', () => {
  it('entrega el evento a todos los suscritos a su clave', async () => {
    const bus = new InMemoryEventBus();
    const uno = vi.fn();
    const dos = vi.fn();
    bus.subscribe('Prueba.v1', uno);
    bus.subscribe('Prueba.v1', dos);

    await bus.publish(evento('Prueba'));

    expect(uno).toHaveBeenCalledWith(evento('Prueba'));
    expect(dos).toHaveBeenCalledOnce();
  });

  it('no entrega eventos de otro tipo ni de otra versión', async () => {
    const bus = new InMemoryEventBus();
    const manejador = vi.fn();
    bus.subscribe('Prueba.v1', manejador);

    await bus.publish(evento('Otro'));
    await bus.publish(evento('Prueba', 2));

    expect(manejador).not.toHaveBeenCalled();
  });

  it('deja de entregar tras cancelar la suscripción', async () => {
    const bus = new InMemoryEventBus();
    const manejador = vi.fn();
    const cancelar = bus.subscribe('Prueba.v1', manejador);

    cancelar();
    await bus.publish(evento('Prueba'));

    expect(manejador).not.toHaveBeenCalled();
  });

  it('el fallo de un manejador no impide la entrega a los demás y se notifica', async () => {
    const alFallar = vi.fn();
    const bus = new InMemoryEventBus(alFallar);
    const fallo = new Error('falló');
    const sano = vi.fn();
    bus.subscribe('Prueba.v1', () => {
      throw fallo;
    });
    bus.subscribe('Prueba.v1', sano);

    await expect(bus.publish(evento('Prueba'))).resolves.toBeUndefined();

    expect(sano).toHaveBeenCalledOnce();
    expect(alFallar).toHaveBeenCalledWith(fallo, evento('Prueba'));
  });

  it('publicar sin suscriptores no falla', async () => {
    await expect(new InMemoryEventBus().publish(evento('Prueba'))).resolves.toBeUndefined();
  });
});
