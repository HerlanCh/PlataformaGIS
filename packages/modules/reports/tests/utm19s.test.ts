import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromUtm19s, toUtm19s } from '../domain/utm19s.js';

// Vectores de referencia calculados con PostGIS 3.5: ST_Transform(punto, 32719).
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
    const { easting, northing } = toUtm19s({ latitude: lat, longitude: lon });

    // Tolerancia de 1 mm.
    expect(Math.abs(easting - este)).toBeLessThan(0.001);
    expect(Math.abs(northing - norte)).toBeLessThan(0.001);
  });

  it('la inversa coincide con PostGIS', () => {
    const { latitude, longitude } = fromUtm19s({ easting: 592500, northing: 8176100 });

    expect(latitude).toBeCloseTo(-16.495095464, 8);
    expect(longitude).toBeCloseTo(-68.133307397, 8);
  });

  it('propiedad: ida y vuelta devuelve el punto original', () => {
    const punto = fc.record({
      latitude: fc.double({ min: -16.67, max: -16.38, noNaN: true }),
      longitude: fc.double({ min: -68.33, max: -68.0, noNaN: true }),
    });

    fc.assert(
      fc.property(punto, (original) => {
        const vuelta = fromUtm19s(toUtm19s(original));

        // 1e-9 grados son unos 0,1 mm.
        expect(Math.abs(vuelta.latitude - original.latitude)).toBeLessThan(1e-9);
        expect(Math.abs(vuelta.longitude - original.longitude)).toBeLessThan(1e-9);
      }),
    );
  });
});
