import { ErrorProhibido, ErrorValidacionFallida } from '@gis/shared-kernel';
import { z } from 'zod';
import { MAX_NOMBRE_DE_INSTANTANEA } from '../domain/instantanea.js';

/** Esquemas y reglas comunes de los casos de uso de la evaluación. */

export const esquemaRol = z.enum(['CIUDADANO', 'MODERADOR']);

const latitud = z.number().min(-90).max(90);
const longitud = z.number().min(-180).max(180);

export const esquemaCaja = z
  .object({
    latitudMin: latitud,
    latitudMax: latitud,
    longitudMin: longitud,
    longitudMax: longitud,
  })
  .refine((caja) => caja.latitudMin < caja.latitudMax && caja.longitudMin < caja.longitudMax, {
    message: 'Cada mínimo de la zona debe ser menor que su máximo',
  });

export const esquemaInstante = z.union([z.date(), z.iso.datetime().transform((t) => new Date(t))]);

export const esquemaNombre = z.string().trim().min(1).max(MAX_NOMBRE_DE_INSTANTANEA);

/**
 * ADR-007: los instrumentos de evaluación son solo para moderadores (los investigadores, durante
 * el piloto).
 * @throws {ErrorProhibido} con código `ROL_INSUFICIENTE` si no es moderador.
 */
export function exigirModerador(rolActor: z.output<typeof esquemaRol>): void {
  if (rolActor !== 'MODERADOR') {
    throw new ErrorProhibido(
      'ROL_INSUFICIENTE',
      'Solo un moderador puede usar los instrumentos de evaluación',
    );
  }
}

/**
 * Un instante futuro no tiene vistas: el registro aún no sabe qué pasará.
 * @throws {ErrorValidacionFallida} con código `INSTANTE_FUTURO`.
 */
export function exigirPasado(instante: Date, ahora: Date): void {
  if (instante.getTime() > ahora.getTime()) {
    throw new ErrorValidacionFallida(
      'INSTANTE_FUTURO',
      'El instante no puede ser posterior a ahora',
    );
  }
}
