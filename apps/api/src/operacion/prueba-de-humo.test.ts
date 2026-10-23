import { describe, expect, it, vi } from 'vitest';
import { ejecutarPruebaDeHumo, FalloDeHumo, PUNTO_DE_HUMO, ventanaDe } from './prueba-de-humo.js';
import type { ClienteDeHumo, OpcionesDeHumo } from './prueba-de-humo.js';

const ID = '00000000-0000-4000-8000-0000000000a1';
const VERSION = 'abc123';

/** API sana: crea, lista hasta que se rechaza y entrega por WebSocket. */
const apiSana = (cambios: Partial<ClienteDeHumo> = {}) => {
  const vigentes = new Set<string>();
  const cerrar = vi.fn();
  const cliente: ClienteDeHumo = {
    salud: () => Promise.resolve({ status: 'ok', version: VERSION }),
    registrar: () => Promise.resolve({ idUsuario: 'humo', rol: 'MODERADOR', token: 't' }),
    escuchar: () => Promise.resolve({ recibio: (id) => Promise.resolve(vigentes.has(id)), cerrar }),
    crearReporte: () => {
      vigentes.add(ID);
      return Promise.resolve({ resultado: 'CREADO', idReporte: ID });
    },
    listar: () => Promise.resolve([...vigentes]),
    rechazar: (_token, id) => {
      vigentes.delete(id);
      return Promise.resolve();
    },
    ...cambios,
  };
  return { cliente, cerrar };
};

const opciones: OpcionesDeHumo = {
  hashDispositivo: 'humo',
  marca: '1',
  versionEsperada: VERSION,
  plazoMs: 1000,
  dormir: () => Promise.resolve(),
};

const falla = (cliente: ClienteDeHumo, paso: string) =>
  expect(ejecutarPruebaDeHumo(cliente, opciones)).rejects.toMatchObject({
    name: 'FalloDeHumo',
    paso,
  });

describe('Prueba de humo del despliegue (roadmap 12)', () => {
  it('RNF-05: recorre salud, registro, crear, leer, tiempo real y rechazo', async () => {
    const { cliente, cerrar } = apiSana();

    const pasos = await ejecutarPruebaDeHumo(cliente, opciones);

    expect(pasos.map((p) => p.split(':')[0])).toEqual([
      'salud',
      'registro',
      'crear',
      'leer',
      'tiempo real',
      'rechazar',
    ]);
    expect(cerrar).toHaveBeenCalledOnce();
  });

  it('RNF-05: falla si la API no sirve la versión desplegada', async () => {
    const { cliente } = apiSana({
      salud: () => Promise.resolve({ status: 'ok', version: 'vieja' }),
    });

    await falla(cliente, 'salud');
  });

  it('RNF-05: falla si la API está degradada', async () => {
    const { cliente } = apiSana({
      salud: () => Promise.resolve({ status: 'degraded', version: VERSION }),
    });

    await falla(cliente, 'salud');
  });

  it('HU-12: falla con instrucciones si el usuario de humo no es moderador', async () => {
    const { cliente } = apiSana({
      registrar: () => Promise.resolve({ idUsuario: 'humo', rol: 'CIUDADANO', token: 't' }),
    });

    await expect(ejecutarPruebaDeHumo(cliente, opciones)).rejects.toThrow(/Administracion/);
  });

  it('HU-01: si el punto cae como duplicado prueba otro, y falla si todos lo son', async () => {
    const crearReporte = vi.fn(() => Promise.resolve({ resultado: 'DUPLICADO', idReporte: 'x' }));
    const { cliente, cerrar } = apiSana({ crearReporte });

    await falla(cliente, 'crear');
    expect(crearReporte).toHaveBeenCalledTimes(3);
    const puntos = crearReporte.mock.calls.map((llamada) => (llamada as unknown[])[1]);
    expect(new Set(puntos.map((p) => JSON.stringify(p))).size).toBe(3);
    expect(cerrar).toHaveBeenCalledOnce();
  });

  it('HU-02: falla si el reporte creado no aparece en el mapa', async () => {
    const { cliente } = apiSana({ listar: () => Promise.resolve([]) });

    await falla(cliente, 'leer');
  });

  it('RNF-10: falla si el reporte no llega por WebSocket', async () => {
    const { cliente } = apiSana({
      escuchar: () => Promise.resolve({ recibio: () => Promise.resolve(false), cerrar: vi.fn() }),
    });

    await falla(cliente, 'tiempo real');
  });

  it('HU-12: falla si el reporte rechazado sigue en el mapa', async () => {
    const { cliente } = apiSana({ rechazar: () => Promise.resolve() });

    await falla(cliente, 'rechazar');
  });

  it('sin versión esperada no la compara', async () => {
    const { cliente } = apiSana({ salud: () => Promise.resolve({ status: 'ok', version: 'x' }) });

    await expect(
      ejecutarPruebaDeHumo(cliente, { ...opciones, versionEsperada: undefined }),
    ).resolves.toHaveLength(6);
  });

  it('la ventana rodea el punto de prueba, dentro de La Paz y El Alto', () => {
    const [lonMin, latMin, lonMax, latMax] = ventanaDe(PUNTO_DE_HUMO).split(',').map(Number);

    expect(lonMin! < PUNTO_DE_HUMO.longitud && PUNTO_DE_HUMO.longitud < lonMax!).toBe(true);
    expect(latMin! < PUNTO_DE_HUMO.latitud && PUNTO_DE_HUMO.latitud < latMax!).toBe(true);
    expect(latMin).toBeGreaterThanOrEqual(-16.67);
    expect(latMax).toBeLessThanOrEqual(-16.38);
    expect(new FalloDeHumo('x', 'y').message).toBe('x: y');
  });
});
