import { pino } from 'pino';
import type { DestinationStream, Logger } from 'pino';

export type { Logger };

/** Logger estructurado en JSON. `destination` permite capturar la salida en pruebas. */
export function createLogger(level: string, destination?: DestinationStream): Logger {
  return pino({ level, base: { service: 'gis-api' } }, destination);
}
