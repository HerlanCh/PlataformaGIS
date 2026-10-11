import { DomainError } from './domain-error.js';

/** Rectángulo envolvente de la conurbación La Paz – El Alto (SRS 1.3). */
export const SERVICE_AREA = {
  minLatitude: -16.67,
  maxLatitude: -16.38,
  minLongitude: -68.33,
  maxLongitude: -68.0,
} as const;

const RADIO_TERRESTRE_M = 6_371_008.8;
const aRadianes = (grados: number): number => (grados * Math.PI) / 180;

export class OutOfServiceAreaError extends DomainError {
  constructor(latitude: number, longitude: number) {
    super(
      'OUT_OF_SERVICE_AREA',
      `La coordenada (${latitude}, ${longitude}) está fuera de La Paz y El Alto`,
    );
  }
}

// El `>=` y `<=` dan falso con NaN: una coordenada no numérica queda fuera del área.
const dentroDelArea = (latitude: number, longitude: number): boolean =>
  latitude >= SERVICE_AREA.minLatitude &&
  latitude <= SERVICE_AREA.maxLatitude &&
  longitude >= SERVICE_AREA.minLongitude &&
  longitude <= SERVICE_AREA.maxLongitude;

/** Punto en WGS84 dentro del área de servicio. Inmutable. */
export class GeoPoint {
  private constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {
    Object.freeze(this);
  }

  /** @throws {OutOfServiceAreaError} si la coordenada cae fuera del rectángulo de servicio. */
  static create(latitude: number, longitude: number): GeoPoint {
    if (!dentroDelArea(latitude, longitude)) throw new OutOfServiceAreaError(latitude, longitude);
    return new GeoPoint(latitude, longitude);
  }

  equals(other: GeoPoint): boolean {
    return this.latitude === other.latitude && this.longitude === other.longitude;
  }

  /** Distancia en metros sobre la esfera (haversine). */
  distanceTo(other: GeoPoint): number {
    const dLat = aRadianes(other.latitude - this.latitude);
    const dLon = aRadianes(other.longitude - this.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(aRadianes(this.latitude)) *
        Math.cos(aRadianes(other.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * RADIO_TERRESTRE_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }
}
