import { GeoPoint, SERVICE_AREA } from '@gis/shared-kernel';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PrivacyPolicy, SENSITIVE_CELL_M } from '../domain/privacy-policy.js';
import { fromUtm19s, toUtm19s } from '../domain/utm19s.js';

const punto = fc
  .tuple(
    fc.double({ min: SERVICE_AREA.minLatitude, max: SERVICE_AREA.maxLatitude, noNaN: true }),
    fc.double({ min: SERVICE_AREA.minLongitude, max: SERVICE_AREA.maxLongitude, noNaN: true }),
  )
  .map(([latitud, longitud]) => GeoPoint.create(latitud, longitud));

// Media diagonal de una celda de 200 m, con margen para la diferencia entre la
// distancia sobre la esfera y la distancia en el plano UTM.
const MAXIMO_DESPLAZAMIENTO_M = 142;

describe('PrivacyPolicy', () => {
  it('HU-02: una categoría no sensible muestra la ubicación exacta', () => {
    const real = GeoPoint.create(-16.5, -68.15);

    expect(PrivacyPolicy.publicLocation(real, false)).toBe(real);
  });

  it('HU-02: una categoría sensible muestra el centro de su celda de 200 m, no la ubicación real', () => {
    const real = GeoPoint.create(-16.4955, -68.1336); // UTM 592468.58 E, 8176055.38 N

    const publica = PrivacyPolicy.publicLocation(real, true);

    const { easting, northing } = toUtm19s(publica);
    expect(easting).toBeCloseTo(592500, 3); // celda [592400, 592600)
    expect(northing).toBeCloseTo(8176100, 3); // celda [8176000, 8176200)
    expect(publica.equals(real)).toBe(false);
  });

  it('dos ubicaciones de la misma celda comparten ubicación pública', () => {
    const esquina = fromUtm19s({ easting: 592401, northing: 8176001 });
    const opuesta = fromUtm19s({ easting: 592599, northing: 8176199 });

    const a = PrivacyPolicy.publicLocation(
      GeoPoint.create(esquina.latitude, esquina.longitude),
      true,
    );
    const b = PrivacyPolicy.publicLocation(
      GeoPoint.create(opuesta.latitude, opuesta.longitude),
      true,
    );

    expect(a.distanceTo(b)).toBeLessThan(0.001);
  });

  it('dos ubicaciones de celdas vecinas tienen ubicaciones públicas distintas', () => {
    const una = fromUtm19s({ easting: 592599, northing: 8176100 });
    const vecina = fromUtm19s({ easting: 592601, northing: 8176100 });

    const a = PrivacyPolicy.publicLocation(GeoPoint.create(una.latitude, una.longitude), true);
    const b = PrivacyPolicy.publicLocation(
      GeoPoint.create(vecina.latitude, vecina.longitude),
      true,
    );

    expect(a.distanceTo(b)).toBeGreaterThan(SENSITIVE_CELL_M - 1);
  });

  it('en el borde del área la ubicación pública sigue dentro del área de servicio', () => {
    const esquinas = [
      GeoPoint.create(SERVICE_AREA.minLatitude, SERVICE_AREA.minLongitude),
      GeoPoint.create(SERVICE_AREA.minLatitude, SERVICE_AREA.maxLongitude),
      GeoPoint.create(SERVICE_AREA.maxLatitude, SERVICE_AREA.minLongitude),
      GeoPoint.create(SERVICE_AREA.maxLatitude, SERVICE_AREA.maxLongitude),
    ];

    for (const esquina of esquinas) {
      expect(() => PrivacyPolicy.publicLocation(esquina, true)).not.toThrow();
    }
  });

  it('propiedad: la ubicación pública queda a 142 m o menos de la real', () => {
    fc.assert(
      fc.property(punto, (real) => {
        const publica = PrivacyPolicy.publicLocation(real, true);

        expect(real.distanceTo(publica)).toBeLessThanOrEqual(MAXIMO_DESPLAZAMIENTO_M);
      }),
    );
  });

  it('propiedad: es idempotente', () => {
    fc.assert(
      fc.property(punto, (real) => {
        const una = PrivacyPolicy.publicLocation(real, true);
        const dos = PrivacyPolicy.publicLocation(una, true);

        // Tolerancia de 1 mm por el redondeo de ida y vuelta de la proyección.
        expect(una.distanceTo(dos)).toBeLessThan(0.001);
      }),
    );
  });
});
