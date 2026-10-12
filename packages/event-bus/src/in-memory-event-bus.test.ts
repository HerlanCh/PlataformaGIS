import type { EventoDeIntegracion } from '@gis/contracts';
import { describe, expect, it, vi } from 'vitest';
import { BusDeEventosEnMemoria } from './index.js';

const evento = (type: string, version = 1): EventoDeIntegracion => ({
  id: '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f',
  tipo: type,
  version,
  ocurridoEn: '2026-10-11T12:00:00Z',
  contenido: {},
});

describe('BusDeEventosEnMemoria', () => {
  it('entrega el evento a todos los suscritos a su clave', async () => {
    const bus = new BusDeEventosEnMemoria();
    const uno = vi.fn();
    const dos = vi.fn();
    bus.suscribir('Prueba.v1', uno);
    bus.suscribir('Prueba.v1', dos);

    await bus.publicar(evento('Prueba'));

    expect(uno).toHaveBeenCalledWith(evento('Prueba'));
    expect(dos).toHaveBeenCalledOnce();
  });

  it('no entrega eventos de otro tipo ni de otra versión', async () => {
    const bus = new BusDeEventosEnMemoria();
    const manejador = vi.fn();
    bus.suscribir('Prueba.v1', manejador);

    await bus.publicar(evento('Otro'));
    await bus.publicar(evento('Prueba', 2));

    expect(manejador).not.toHaveBeenCalled();
  });

  it('deja de entregar tras cancelar la suscripción', async () => {
    const bus = new BusDeEventosEnMemoria();
    const manejador = vi.fn();
    const cancelar = bus.suscribir('Prueba.v1', manejador);

    cancelar();
    await bus.publicar(evento('Prueba'));

    expect(manejador).not.toHaveBeenCalled();
  });

  it('el fallo de un manejador no impide la entrega a los demás y se notifica', async () => {
    const alFallar = vi.fn();
    const bus = new BusDeEventosEnMemoria(alFallar);
    const fallo = new Error('falló');
    const sano = vi.fn();
    bus.suscribir('Prueba.v1', () => {
      throw fallo;
    });
    bus.suscribir('Prueba.v1', sano);

    await expect(bus.publicar(evento('Prueba'))).resolves.toBeUndefined();

    expect(sano).toHaveBeenCalledOnce();
    expect(alFallar).toHaveBeenCalledWith(fallo, evento('Prueba'));
  });

  it('publicar sin suscriptores no falla', async () => {
    await expect(new BusDeEventosEnMemoria().publicar(evento('Prueba'))).resolves.toBeUndefined();
  });
});
