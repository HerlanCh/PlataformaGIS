import { GeoPoint, SERVICE_AREA } from '@gis/shared-kernel';
import { fromUtm19s, toUtm19s } from './utm19s.js';

/** Lado de la celda de ofuscación para categorías sensibles, en metros (SRS 3.1). */
export const SENSITIVE_CELL_M = 200;

const centroDeCelda = (metros: number): number =>
  Math.floor(metros / SENSITIVE_CELL_M) * SENSITIVE_CELL_M + SENSITIVE_CELL_M / 2;

const acotar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor));

export const PrivacyPolicy = {
  /**
   * Ubicación que se muestra al público. En una categoría sensible es el centro de la
   * celda de 200 m (cuadrícula UTM 19 Sur) que contiene a la ubicación real; en las
   * demás, la ubicación exacta.
   */
  publicLocation(location: GeoPoint, isSensitive: boolean): GeoPoint {
    if (!isSensitive) return location;

    const { easting, northing } = toUtm19s(location);
    const centro = fromUtm19s({
      easting: centroDeCelda(easting),
      northing: centroDeCelda(northing),
    });

    // En el borde del área de servicio el centro de la celda puede caer fuera: se acota.
    return GeoPoint.create(
      acotar(centro.latitude, SERVICE_AREA.minLatitude, SERVICE_AREA.maxLatitude),
      acotar(centro.longitude, SERVICE_AREA.minLongitude, SERVICE_AREA.maxLongitude),
    );
  },
};
