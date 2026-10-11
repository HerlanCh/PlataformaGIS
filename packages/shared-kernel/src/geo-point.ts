/**
 * Punto en WGS84. La validación contra el rectángulo de La Paz y El Alto
 * (SRS 1.3) se añade en la Fase 2 como objeto de valor.
 */
export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}
