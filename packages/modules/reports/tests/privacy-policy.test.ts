import { PuntoGeo, AREA_DE_SERVICIO } from '@gis/shared-kernel';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PoliticaDePrivacidad, CELDA_SENSIBLE_M } from '../domain/privacy-policy.js';
import { desdeUtm19s, aUtm19s } from '../domain/utm19s.js';

const punto = fc
  .tuple(
    fc.double({ min: AREA_DE_SERVICIO.latitudMin, max: AREA_DE_SERVICIO.latitudMax, noNaN: true }),
    fc.double({
      min: AREA_DE_SERVICIO.longitudMin,
      max: AREA_DE_SERVICIO.longitudMax,
      noNaN: true,
    }),
  )
  .map(([latitud, longitud]) => PuntoGeo.crear(latitud, longitud));

// Media diagonal de una celda de 200 m, con margen para la diferencia entre la
// distancia sobre la esfera y la distancia en el plano UTM.
const MAXIMO_DESPLAZAMIENTO_M = 142;

describe('PoliticaDePrivacidad', () => {
  it('HU-02: una categoría no sensible muestra la ubicación exacta', () => {
    const real = PuntoGeo.crear(-16.5, -68.15);

    expect(PoliticaDePrivacidad.ubicacionPublica(real, false)).toBe(real);
  });

  it('HU-02: una categoría sensible muestra el centro de su celda de 200 m, no la ubicación real', () => {
    const real = PuntoGeo.crear(-16.4955, -68.1336); // UTM 592468.58 E, 8176055.38 N

    const publica = PoliticaDePrivacidad.ubicacionPublica(real, true);

    const { este: easting, norte: northing } = aUtm19s(publica);
    expect(easting).toBeCloseTo(592500, 3); // celda [592400, 592600)
    expect(northing).toBeCloseTo(8176100, 3); // celda [8176000, 8176200)
    expect(publica.esIgualA(real)).toBe(false);
  });

  it('dos ubicaciones de la misma celda comparten ubicación pública', () => {
    const esquina = desdeUtm19s({ este: 592401, norte: 8176001 });
    const opuesta = desdeUtm19s({ este: 592599, norte: 8176199 });

    const a = PoliticaDePrivacidad.ubicacionPublica(
      PuntoGeo.crear(esquina.latitud, esquina.longitud),
      true,
    );
    const b = PoliticaDePrivacidad.ubicacionPublica(
      PuntoGeo.crear(opuesta.latitud, opuesta.longitud),
      true,
    );

    expect(a.distanciaA(b)).toBeLessThan(0.001);
  });

  it('dos ubicaciones de celdas vecinas tienen ubicaciones públicas distintas', () => {
    const una = desdeUtm19s({ este: 592599, norte: 8176100 });
    const vecina = desdeUtm19s({ este: 592601, norte: 8176100 });

    const a = PoliticaDePrivacidad.ubicacionPublica(
      PuntoGeo.crear(una.latitud, una.longitud),
      true,
    );
    const b = PoliticaDePrivacidad.ubicacionPublica(
      PuntoGeo.crear(vecina.latitud, vecina.longitud),
      true,
    );

    expect(a.distanciaA(b)).toBeGreaterThan(CELDA_SENSIBLE_M - 1);
  });

  it('en el borde del área la ubicación pública sigue dentro del área de servicio', () => {
    const esquinas = [
      PuntoGeo.crear(AREA_DE_SERVICIO.latitudMin, AREA_DE_SERVICIO.longitudMin),
      PuntoGeo.crear(AREA_DE_SERVICIO.latitudMin, AREA_DE_SERVICIO.longitudMax),
      PuntoGeo.crear(AREA_DE_SERVICIO.latitudMax, AREA_DE_SERVICIO.longitudMin),
      PuntoGeo.crear(AREA_DE_SERVICIO.latitudMax, AREA_DE_SERVICIO.longitudMax),
    ];

    for (const esquina of esquinas) {
      expect(() => PoliticaDePrivacidad.ubicacionPublica(esquina, true)).not.toThrow();
    }
  });

  it('propiedad: la ubicación pública queda a 142 m o menos de la real', () => {
    fc.assert(
      fc.property(punto, (real) => {
        const publica = PoliticaDePrivacidad.ubicacionPublica(real, true);

        expect(real.distanciaA(publica)).toBeLessThanOrEqual(MAXIMO_DESPLAZAMIENTO_M);
      }),
    );
  });

  it('propiedad: es idempotente', () => {
    fc.assert(
      fc.property(punto, (real) => {
        const una = PoliticaDePrivacidad.ubicacionPublica(real, true);
        const dos = PoliticaDePrivacidad.ubicacionPublica(una, true);

        // Tolerancia de 1 mm por el redondeo de ida y vuelta de la proyección.
        expect(una.distanciaA(dos)).toBeLessThan(0.001);
      }),
    );
  });
});
