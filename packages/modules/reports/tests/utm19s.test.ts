import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { desdeUtm19s, aUtm19s } from '../domain/utm19s.js';

// Vectores de referencia calculados con PostGIS: ST_Transform(punto, 32719). Idénticos en 3.5 y 3.6.
const REFERENCIA: [nombre: string, lat: number, lon: number, este: number, norte: number][] = [
  ['Plaza Murillo', -16.4955, -68.1336, 592468.5771, 8176055.3802],
  ['Ceja de El Alto', -16.5047, -68.1633, 589294.3594, 8175050.9663],
  ['esquina suroeste del área', -16.67, -68.33, 571441.9711, 8156830.7955],
  ['esquina noreste del área', -16.38, -68.0, 606791.6076, 8188767.5648],
  ['Chasquipampa', -16.539, -68.048, 601582.3806, 8171201.6872],
  ['Ventilla', -16.614, -68.171, 588422.6838, 8162962.4981],
];

describe('proyección UTM 19 Sur', () => {
  it.each(REFERENCIA)('coincide con PostGIS en %s', (_nombre, lat, lon, este, norte) => {
    const { este: easting, norte: northing } = aUtm19s({ latitud: lat, longitud: lon });

    // Tolerancia de 1 mm.
    expect(Math.abs(easting - este)).toBeLessThan(0.001);
    expect(Math.abs(northing - norte)).toBeLessThan(0.001);
  });

  it('la inversa coincide con PostGIS', () => {
    const { latitud: latitude, longitud: longitude } = desdeUtm19s({
      este: 592500,
      norte: 8176100,
    });

    expect(latitude).toBeCloseTo(-16.495095464, 8);
    expect(longitude).toBeCloseTo(-68.133307397, 8);
  });

  it('propiedad: ida y vuelta devuelve el punto original', () => {
    const punto = fc.record({
      latitud: fc.double({ min: -16.67, max: -16.38, noNaN: true }),
      longitud: fc.double({ min: -68.33, max: -68.0, noNaN: true }),
    });

    fc.assert(
      fc.property(punto, (original) => {
        const vuelta = desdeUtm19s(aUtm19s(original));

        // 1e-9 grados son unos 0,1 mm.
        expect(Math.abs(vuelta.latitud - original.latitud)).toBeLessThan(1e-9);
        expect(Math.abs(vuelta.longitud - original.longitud)).toBeLessThan(1e-9);
      }),
    );
  });
});
