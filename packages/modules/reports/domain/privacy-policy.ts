import { PuntoGeo, AREA_DE_SERVICIO } from '@gis/shared-kernel';
import { desdeUtm19s, aUtm19s } from './utm19s.js';

/** Lado de la celda de ofuscación para categorías sensibles, en metros (SRS 3.1). */
export const CELDA_SENSIBLE_M = 200;

const centroDeCelda = (metros: number): number =>
  Math.floor(metros / CELDA_SENSIBLE_M) * CELDA_SENSIBLE_M + CELDA_SENSIBLE_M / 2;

const acotar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor));

export const PoliticaDePrivacidad = {
  /**
   * Ubicación que se muestra al público. En una categoría sensible es el centro de la
   * celda de 200 m (cuadrícula UTM 19 Sur) que contiene a la ubicación real; en las
   * demás, la ubicación exacta.
   */
  ubicacionPublica(location: PuntoGeo, esSensible: boolean): PuntoGeo {
    if (!esSensible) return location;

    const { este: easting, norte: northing } = aUtm19s(location);
    const centro = desdeUtm19s({
      este: centroDeCelda(easting),
      norte: centroDeCelda(northing),
    });

    // En el borde del área de servicio el centro de la celda puede caer fuera: se acota.
    return PuntoGeo.crear(
      acotar(centro.latitud, AREA_DE_SERVICIO.latitudMin, AREA_DE_SERVICIO.latitudMax),
      acotar(centro.longitud, AREA_DE_SERVICIO.longitudMin, AREA_DE_SERVICIO.longitudMax),
    );
  },
};
