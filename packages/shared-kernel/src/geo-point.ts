import { ErrorDeDominio } from './domain-error.js';

/** Rectángulo envolvente de la conurbación La Paz – El Alto (SRS 1.3). */
export const AREA_DE_SERVICIO = {
  latitudMin: -16.67,
  latitudMax: -16.38,
  longitudMin: -68.33,
  longitudMax: -68.0,
} as const;

const RADIO_TERRESTRE_M = 6_371_008.8;
const aRadianes = (grados: number): number => (grados * Math.PI) / 180;

export class ErrorFueraDelAreaDeServicio extends ErrorDeDominio {
  constructor(latitude: number, longitude: number) {
    super(
      'FUERA_DEL_AREA_DE_SERVICIO',
      `La coordenada (${latitude}, ${longitude}) está fuera de La Paz y El Alto`,
    );
  }
}

// El `>=` y `<=` dan falso con NaN: una coordenada no numérica queda fuera del área.
const dentroDelArea = (latitude: number, longitude: number): boolean =>
  latitude >= AREA_DE_SERVICIO.latitudMin &&
  latitude <= AREA_DE_SERVICIO.latitudMax &&
  longitude >= AREA_DE_SERVICIO.longitudMin &&
  longitude <= AREA_DE_SERVICIO.longitudMax;

/** Punto en WGS84 dentro del área de servicio. Inmutable. */
export class PuntoGeo {
  private constructor(
    readonly latitud: number,
    readonly longitud: number,
  ) {
    Object.freeze(this);
  }

  /** @throws {ErrorFueraDelAreaDeServicio} si la coordenada cae fuera del rectángulo de servicio. */
  static crear(latitude: number, longitude: number): PuntoGeo {
    if (!dentroDelArea(latitude, longitude))
      throw new ErrorFueraDelAreaDeServicio(latitude, longitude);
    return new PuntoGeo(latitude, longitude);
  }

  esIgualA(other: PuntoGeo): boolean {
    return this.latitud === other.latitud && this.longitud === other.longitud;
  }

  /** Distancia en metros sobre la esfera (haversine). */
  distanciaA(other: PuntoGeo): number {
    const dLat = aRadianes(other.latitud - this.latitud);
    const dLon = aRadianes(other.longitud - this.longitud);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(aRadianes(this.latitud)) *
        Math.cos(aRadianes(other.latitud)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * RADIO_TERRESTRE_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }
}
