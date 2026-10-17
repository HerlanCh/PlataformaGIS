import { celdaDe, celdasQueCubren, ErrorAreaDemasiadoGrande } from '@gis/shared-kernel';
import type { CajaGeografica, PuntoGeo } from '@gis/shared-kernel';

/** Celdas de unos 1,2 km × 0,6 km: la precisión normal de una ventana del mapa. */
const PRECISION_FINA = 6;
/** Celdas de unos 5 km: para ventanas grandes, como toda la ciudad. */
const PRECISION_GRUESA = 5;
/** Salas por cliente: acota la memoria y el trabajo del servidor por socket. */
export const MAX_SALAS_POR_CLIENTE = 300;

export const sala = (celda: string): string => `celda:${celda}`;

/**
 * Salas que debe escuchar un cliente para su ventana: celdas finas si caben en el máximo;
 * si no, gruesas. `null` si ni así caben (hay que acercar el mapa).
 */
export function salasDeVentana(caja: CajaGeografica): string[] | null {
  for (const precision of [PRECISION_FINA, PRECISION_GRUESA]) {
    try {
      const celdas = celdasQueCubren(caja, precision);
      if (celdas.length <= MAX_SALAS_POR_CLIENTE) return celdas.map(sala);
    } catch (error) {
      if (!(error instanceof ErrorAreaDemasiadoGrande)) throw error;
    }
  }
  return null;
}

/** Salas a las que llega un evento ocurrido en el punto: su celda fina y su celda gruesa. */
export const salasDePunto = (punto: PuntoGeo): string[] => [
  sala(celdaDe(punto, PRECISION_FINA)),
  sala(celdaDe(punto, PRECISION_GRUESA)),
];
