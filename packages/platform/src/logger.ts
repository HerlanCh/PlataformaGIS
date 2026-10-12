import { pino } from 'pino';
import type { DestinationStream, Logger } from 'pino';

export type Registro = Logger;

/** Registro estructurado en JSON. `destino` permite capturar la salida en pruebas. */
export function crearRegistro(nivel: string, destino?: DestinationStream): Registro {
  return pino({ level: nivel, base: { service: 'gis-api' } }, destino);
}
