import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  AREA_DE_SERVICIO,
  celdaDe,
  codificarGeohash,
  celdasQueCubren,
  ErrorAreaDemasiadoGrande,
  limitesDeCelda,
  PuntoGeo,
} from './index.js';
import type { CajaGeografica } from './index.js';

const {
  latitudMin: minLatitud,
  latitudMax: maxLatitud,
  longitudMin: minLongitud,
  longitudMax: maxLongitud,
} = AREA_DE_SERVICIO;

const puntoDentro = fc
  .tuple(
    fc.double({ min: minLatitud, max: maxLatitud, noNaN: true }),
    fc.double({ min: minLongitud, max: maxLongitud, noNaN: true }),
  )
  .map(([latitud, longitud]) => PuntoGeo.crear(latitud, longitud));

describe('celdaDe', () => {
  // Vectores publicados de geohash (Wikipedia y geohash.org); caen fuera de La Paz, por eso se usa
  // la función de bajo nivel, que no restringe el área de servicio.
  it.each([
    [57.64911, 10.40744, 11, 'u4pruydqqvj'],
    [42.6, -5.6, 5, 'ezs42'],
    [-25.382708, -49.265506, 8, '6gkzwgjz'],
  ])('codificarGeohash(%d, %d, %d) es %s', (latitud, longitud, precision, esperada) => {
    expect(codificarGeohash(latitud, longitud, precision)).toBe(esperada);
  });

  // Valores de La Paz calculados con la misma función, ya validada con los vectores anteriores.
  it.each([
    [-16.4955, -68.1336, 6, '6mpd1t'],
    [-16.4955, -68.1336, 5, '6mpd1'],
    [-16.5, -68.15, 6, '6mpd1h'],
  ])('HU-02: (%d, %d) con precisión %d es %s', (latitud, longitud, precision, esperada) => {
    expect(celdaDe(PuntoGeo.crear(latitud, longitud), precision)).toBe(esperada);
  });

  it('usa precisión 6 por defecto', () => {
    const punto = PuntoGeo.crear(-16.4955, -68.1336);

    expect(celdaDe(punto)).toHaveLength(6);
    expect(celdaDe(punto)).toBe(celdaDe(punto, 6));
  });

  it('la celda de menor precisión es el prefijo de la de mayor precisión', () => {
    fc.assert(
      fc.property(puntoDentro, (punto) => {
        expect(celdaDe(punto, 8).startsWith(celdaDe(punto, 6))).toBe(true);
      }),
    );
  });

  it('propiedad: la celda contiene al punto que la generó', () => {
    fc.assert(
      fc.property(puntoDentro, (punto) => {
        const caja = limitesDeCelda(celdaDe(punto));

        expect(punto.latitud).toBeGreaterThanOrEqual(caja.latitudMin);
        expect(punto.latitud).toBeLessThanOrEqual(caja.latitudMax);
        expect(punto.longitud).toBeGreaterThanOrEqual(caja.longitudMin);
        expect(punto.longitud).toBeLessThanOrEqual(caja.longitudMax);
      }),
    );
  });

  it.each([0, -1, 1.5, 13])('rechaza la precisión %d', (precision) => {
    expect(() => celdaDe(PuntoGeo.crear(-16.5, -68.15), precision)).toThrow(RangeError);
  });
});

describe('limitesDeCelda', () => {
  it('una celda de precisión 6 mide unos 1,2 km por 0,6 km', () => {
    const caja = limitesDeCelda('6mpd1t');

    expect(caja.longitudMax - caja.longitudMin).toBeCloseTo(360 / 2 ** 15, 9);
    expect(caja.latitudMax - caja.latitudMin).toBeCloseTo(180 / 2 ** 15, 9);
  });

  it.each(['', 'a', '6jk4a!', '6jk4dá'])('rechaza la celda inválida "%s"', (celda) => {
    expect(() => limitesDeCelda(celda)).toThrow(RangeError);
  });
});

describe('celdasQueCubren', () => {
  const plazaMurillo: CajaGeografica = {
    latitudMin: -16.5,
    latitudMax: -16.49,
    longitudMin: -68.14,
    longitudMax: -68.13,
  };

  it('devuelve una sola celda si la caja cabe en ella', () => {
    const caja: CajaGeografica = {
      latitudMin: -16.4956,
      latitudMax: -16.4955,
      longitudMin: -68.1337,
      longitudMax: -68.1336,
    };

    expect(celdasQueCubren(caja)).toEqual(['6mpd1t']);
  });

  it('no repite celdas y todas tienen la precisión pedida', () => {
    const celdas = celdasQueCubren(plazaMurillo, 6);

    expect(new Set(celdas).size).toBe(celdas.length);
    expect(celdas.every((celda) => celda.length === 6)).toBe(true);
  });

  it('propiedad: toda celda de un punto de la caja está en la lista', () => {
    const puntoEnCaja = fc.tuple(
      fc.double({ min: plazaMurillo.latitudMin, max: plazaMurillo.latitudMax, noNaN: true }),
      fc.double({ min: plazaMurillo.longitudMin, max: plazaMurillo.longitudMax, noNaN: true }),
    );
    const celdas = new Set(celdasQueCubren(plazaMurillo, 6));

    fc.assert(
      fc.property(puntoEnCaja, ([latitud, longitud]) => {
        expect(celdas.has(celdaDe(PuntoGeo.crear(latitud, longitud), 6))).toBe(true);
      }),
    );
  });

  it('cubre toda el área de servicio con precisión 6', () => {
    const celdas = celdasQueCubren({
      latitudMin: minLatitud,
      latitudMax: maxLatitud,
      longitudMin: minLongitud,
      longitudMax: maxLongitud,
    });

    expect(celdas.length).toBeGreaterThan(1000);
  });

  it('rechaza un área demasiado grande para la precisión', () => {
    const caja: CajaGeografica = {
      latitudMin: minLatitud,
      latitudMax: maxLatitud,
      longitudMin: minLongitud,
      longitudMax: maxLongitud,
    };

    expect(() => celdasQueCubren(caja, 8)).toThrow(ErrorAreaDemasiadoGrande);
  });

  it('rechaza una caja invertida', () => {
    expect(() =>
      celdasQueCubren({ ...plazaMurillo, latitudMin: -16.4, latitudMax: -16.5 }),
    ).toThrow(RangeError);
  });
});
