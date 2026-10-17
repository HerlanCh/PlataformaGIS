import { cargarInterruptores, crearRegistro } from '@gis/platform';
import type { Db } from '@gis/platform';
import { RelojFijo } from '@gis/testing';
import { describe, expect, it, vi } from 'vitest';
import { crearApagado } from '../apagado.js';
import { componerCasosDeUso, generadorUuid, relojDelSistema } from './casos-de-uso.js';
import { LimitadorDeFrecuenciaEnProceso } from './limitador.js';

describe('LimitadorDeFrecuenciaEnProceso', () => {
  it('admite hasta el límite en la ventana y luego indica cuánto esperar', async () => {
    const reloj = new RelojFijo();
    const limitador = new LimitadorDeFrecuenciaEnProceso(reloj);
    await limitador.consumir('a', 2, 600);
    reloj.avanzarMinutos(4);
    await limitador.consumir('a', 2, 600);

    expect(await limitador.consumir('a', 2, 600)).toEqual({
      permitido: false,
      reintentarEnSegundos: 6 * 60,
    });
    expect((await limitador.consumir('b', 2, 600)).permitido).toBe(true);
    reloj.avanzarMinutos(6);
    expect((await limitador.consumir('a', 2, 600)).permitido).toBe(true);
  });

  it('olvida las claves sin consumos vigentes', async () => {
    const reloj = new RelojFijo();
    const limitador = new LimitadorDeFrecuenciaEnProceso(reloj);
    await limitador.consumir('vieja', 1, 60);
    reloj.avanzarMinutos(5);
    for (let i = 0; i < 1000; i += 1) await limitador.consumir(`k${i}`, 1, 60);

    expect(
      (limitador as unknown as { instantesPorClave: Map<string, number[]> }).instantesPorClave.has(
        'vieja',
      ),
    ).toBe(false);
  });
});

describe('composición', () => {
  it('los módulos opcionales apagados no tienen casos de uso', () => {
    const casos = componerCasosDeUso({
      db: {} as Db,
      interruptores: cargarInterruptores({}),
      limitador: new LimitadorDeFrecuenciaEnProceso(relojDelSistema),
    });

    expect(casos.obtenerMapaDeCalor).toBeNull();
    expect(casos.suscribirZona).toBeNull();
    expect(casos.rechazarReporte).toBeNull();
    expect(casos.crearReporte).toBeDefined();
  });

  it('el reloj y el generador del sistema dan la hora actual y UUID distintos', () => {
    expect(Math.abs(relojDelSistema.ahora().getTime() - Date.now())).toBeLessThan(1000);
    expect(generadorUuid.siguiente()).not.toBe(generadorUuid.siguiente());
  });
});

describe('crearApagado', () => {
  const registro = crearRegistro('silent');

  it('cierra los recursos en orden una sola vez y termina con 0', async () => {
    const orden: string[] = [];
    const salir = vi.fn();
    const recurso = (nombre: string) => ({
      nombre,
      cerrar: async () => void orden.push(nombre),
    });
    const apagar = crearApagado({
      recursos: [recurso('websocket'), recurso('http'), recurso('base de datos')],
      registro,
      salir,
    });

    await Promise.all([apagar('SIGTERM'), apagar('SIGINT')]);

    expect(orden).toEqual(['websocket', 'http', 'base de datos']);
    expect(salir).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('si un cierre falla, termina con 1', async () => {
    const salir = vi.fn();
    const apagar = crearApagado({
      recursos: [{ nombre: 'http', cerrar: () => Promise.reject(new Error('x')) }],
      registro,
      salir,
    });

    await apagar('SIGTERM');

    expect(salir).toHaveBeenCalledWith(1);
  });

  it('si el cierre tarda más del límite, fuerza la salida', async () => {
    vi.useFakeTimers();
    const salir = vi.fn();
    const apagar = crearApagado({
      recursos: [{ nombre: 'colgado', cerrar: () => new Promise<void>(() => {}) }],
      registro,
      salir,
      limiteMs: 100,
    });

    void apagar('SIGTERM');
    await vi.advanceTimersByTimeAsync(150);
    vi.useRealTimers();

    expect(salir).toHaveBeenCalledWith(1);
  });
});
