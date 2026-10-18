export interface Punto {
  readonly latitud: number;
  readonly longitud: number;
}

export interface Caja {
  readonly latitudMin: number;
  readonly latitudMax: number;
  readonly longitudMin: number;
  readonly longitudMax: number;
}

/** Centro de La Paz: donde se abre el mapa si no hay posición del usuario. */
export const CENTRO_LA_PAZ: Punto = { latitud: -16.4955, longitud: -68.1336 };

/** Zoom con el que abre el mapa, centrado en La Paz. */
export const ZOOM_INICIAL = 15;

/** Tesela (x, y) de OpenStreetMap que contiene el punto en ese zoom (proyección Web Mercator). */
export function teselaDe(punto: Punto, zoom: number): { readonly x: number; readonly y: number } {
  const n = 2 ** zoom;
  const latitudRad = (punto.latitud * Math.PI) / 180;
  return {
    x: Math.floor(((punto.longitud + 180) / 360) * n),
    y: Math.floor(((1 - Math.asinh(Math.tan(latitudRad)) / Math.PI) / 2) * n),
  };
}

/** Rectángulo de servicio (SRS 1.3): La Paz y El Alto. */
export const AREA_DE_SERVICIO: Caja = {
  latitudMin: -16.67,
  latitudMax: -16.38,
  longitudMin: -68.33,
  longitudMax: -68.0,
};

const RADIO_TERRESTRE_M = 6_371_008.8;
const aRad = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en metros sobre la esfera (haversine). */
export function distanciaM(a: Punto, b: Punto): number {
  const dLat = aRad(b.latitud - a.latitud);
  const dLon = aRad(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad(a.latitud)) * Math.cos(aRad(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TERRESTRE_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "350 m" o "1,2 km", como se dice en la calle. */
export function formatearDistancia(metros: number): string {
  if (metros < 950) return `${Math.max(10, Math.round(metros / 10) * 10)} m`;
  return `${(metros / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} km`;
}

export const dentroDe = (punto: Punto, caja: Caja): boolean =>
  punto.latitud >= caja.latitudMin &&
  punto.latitud <= caja.latitudMax &&
  punto.longitud >= caja.longitudMin &&
  punto.longitud <= caja.longitudMax;

/** `lonMin,latMin,lonMax,latMax`, el formato de la API y de Leaflet, redondeado a ~1 m. */
export const aBbox = (caja: Caja): string =>
  [caja.longitudMin, caja.latitudMin, caja.longitudMax, caja.latitudMax]
    .map((n) => n.toFixed(5))
    .join(',');
