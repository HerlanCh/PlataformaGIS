import { ErrorConflicto, ErrorNoEncontrado, ErrorProhibido } from '@gis/shared-kernel';
import type { IdReporte } from '@gis/shared-kernel';
import { z } from 'zod';
import type { ConsultaDeReporte } from '../domain/ports.js';

/** Rol del actor según su credencial (Fase 6). */
export const esquemaRol = z.enum(['CIUDADANO', 'MODERADOR']);

/** HU-12, escenario 2: solo un moderador decide sobre reportes. */
export function exigirModerador(rol: z.infer<typeof esquemaRol>): void {
  if (rol !== 'MODERADOR') {
    throw new ErrorProhibido('ROL_INSUFICIENTE', 'Solo un moderador puede moderar reportes');
  }
}

/** Solo se decide sobre un reporte que existe y sigue vigente. */
export async function asegurarVigente(
  consulta: ConsultaDeReporte,
  idReporte: IdReporte,
): Promise<void> {
  const estado = await consulta.estadoDe(idReporte);
  if (estado === null) throw new ErrorNoEncontrado('REPORTE_NO_ENCONTRADO', 'El reporte no existe');
  if (estado !== 'ACTIVO' && estado !== 'CONFIRMADO') {
    throw new ErrorConflicto('REPORTE_NO_VIGENTE', `Un reporte ${estado} ya no se puede moderar`);
  }
}
