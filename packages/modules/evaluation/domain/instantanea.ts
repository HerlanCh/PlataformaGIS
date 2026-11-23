import type { Caja, Vistas } from './vistas.js';

/** Largo máximo del nombre de una instantánea (`E1`, `E2`, `ensayo-centro`...). */
export const MAX_NOMBRE_DE_INSTANTANEA = 40;

/**
 * ADR-007: el contenido de ambas vistas de una zona en un instante, congelado. Es inmutable: las
 * tareas cronometradas usan instantáneas, nunca datos en vivo.
 */
export interface Instantanea extends Vistas {
  readonly id: string;
  readonly nombre: string;
  readonly creadaEn: Date;
}

export interface ResumenDeInstantanea {
  readonly id: string;
  readonly nombre: string;
  readonly instante: Date;
  readonly caja: Caja;
  readonly creadaEn: Date;
  readonly puntosProcesada: number;
  readonly puntosBase: number;
}
