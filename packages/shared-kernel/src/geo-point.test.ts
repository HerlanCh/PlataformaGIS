import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GeoPoint, OutOfServiceAreaError, SERVICE_AREA } from './index.js';

const { minLatitude, maxLatitude, minLongitude, maxLongitude } = SERVICE_AREA;

const latitudDentro = fc.double({ min: minLatitude, max: maxLatitude, noNaN: true });
const longitudDentro = fc.double({ min: minLongitude, max: maxLongitude, noNaN: true });
const puntoDentro = fc
  .tuple(latitudDentro, longitudDentro)
  .map(([latitud, longitud]) => GeoPoint.create(latitud, longitud));

describe('GeoPoint', () => {
  it('HU-01: acepta una ubicación de La Paz', () => {
    const punto = GeoPoint.create(-16.5, -68.15);

    expect(punto).toMatchObject({ latitude: -16.5, longitude: -68.15 });
  });

  it.each([
    ['Cochabamba', -17.3895, -66.1568],
    ['justo al norte del límite', -16.3799, -68.15],
    ['justo al sur del límite', -16.6701, -68.15],
    ['justo al este del límite', -16.5, -67.9999],
    ['justo al oeste del límite', -16.5, -68.3301],
    ['una latitud no numérica', Number.NaN, -68.15],
    ['una longitud infinita', -16.5, Number.POSITIVE_INFINITY],
  ])('HU-01: rechaza %s', (_caso, latitud, longitud) => {
    expect(() => GeoPoint.create(latitud, longitud)).toThrow(OutOfServiceAreaError);
  });

  it('acepta los bordes del rectángulo', () => {
    expect(() => GeoPoint.create(minLatitude, minLongitude)).not.toThrow();
    expect(() => GeoPoint.create(maxLatitude, maxLongitude)).not.toThrow();
  });

  it('incluye los barrios de borde contrastados en el SRS', () => {
    const barrios: [string, number, number][] = [
      ['Chasquipampa', -16.539, -68.048],
      ['Ovejuyo', -16.535, -68.039],
      ['Senkata', -16.583, -68.185],
      ['Ventilla', -16.614, -68.171],
      ['San Roque', -16.476, -68.276],
      ['Achachicala', -16.431, -68.138],
    ];

    for (const [, latitud, longitud] of barrios) {
      expect(() => GeoPoint.create(latitud, longitud)).not.toThrow();
    }
  });

  it('es inmutable', () => {
    const punto = GeoPoint.create(-16.5, -68.15);

    expect(() => {
      (punto as { latitude: number }).latitude = 0;
    }).toThrow(TypeError);
  });

  it('compara por valor', () => {
    expect(GeoPoint.create(-16.5, -68.15).equals(GeoPoint.create(-16.5, -68.15))).toBe(true);
    expect(GeoPoint.create(-16.5, -68.15).equals(GeoPoint.create(-16.5, -68.16))).toBe(false);
    expect(GeoPoint.create(-16.5, -68.15).equals(GeoPoint.create(-16.51, -68.15))).toBe(false);
  });

  it('mide una distancia conocida: Plaza Murillo a la Ceja de El Alto', () => {
    const plazaMurillo = GeoPoint.create(-16.4955, -68.1336);
    const ceja = GeoPoint.create(-16.5047, -68.1633);

    // Unos 3,3 km en línea recta.
    expect(plazaMurillo.distanceTo(ceja)).toBeGreaterThan(3200);
    expect(plazaMurillo.distanceTo(ceja)).toBeLessThan(3400);
  });

  it('propiedad: todo punto dentro del rectángulo se crea', () => {
    fc.assert(
      fc.property(latitudDentro, longitudDentro, (latitud, longitud) => {
        expect(GeoPoint.create(latitud, longitud)).toMatchObject({
          latitude: latitud,
          longitude: longitud,
        });
      }),
    );
  });

  it('propiedad: todo punto fuera del rectángulo es rechazado', () => {
    const latitudFuera = fc.oneof(
      fc.double({ min: -90, max: minLatitude, maxExcluded: true, noNaN: true }),
      fc.double({ min: maxLatitude, max: 90, minExcluded: true, noNaN: true }),
    );
    const longitudFuera = fc.oneof(
      fc.double({ min: -180, max: minLongitude, maxExcluded: true, noNaN: true }),
      fc.double({ min: maxLongitude, max: 180, minExcluded: true, noNaN: true }),
    );

    fc.assert(
      fc.property(latitudFuera, longitudDentro, (latitud, longitud) => {
        expect(() => GeoPoint.create(latitud, longitud)).toThrow(OutOfServiceAreaError);
      }),
    );
    fc.assert(
      fc.property(latitudDentro, longitudFuera, (latitud, longitud) => {
        expect(() => GeoPoint.create(latitud, longitud)).toThrow(OutOfServiceAreaError);
      }),
    );
  });

  it('propiedad: la distancia es simétrica, no negativa y nula solo consigo mismo', () => {
    fc.assert(
      fc.property(puntoDentro, puntoDentro, (a, b) => {
        expect(a.distanceTo(b)).toBeGreaterThanOrEqual(0);
        expect(a.distanceTo(b)).toBeCloseTo(b.distanceTo(a), 6);
        expect(a.distanceTo(a)).toBe(0);
      }),
    );
  });
});
