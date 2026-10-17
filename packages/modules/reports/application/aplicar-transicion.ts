import { idReporte } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { ErrorLimiteDeExtensiones, ErrorTransicionInvalida } from '../domain/errors.js';
import type { RepositorioDeReportes } from '../domain/ports.js';
import type { Reporte } from '../domain/report.js';
import { eventosDeIntegracionDe } from './eventos.js';
import type { UnidadDeTrabajoDeReporte } from './ports.js';

export interface DependenciasDeTransicion {
  readonly reportes: RepositorioDeReportes;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeReporte;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/**
 * Aplica a un reporte el cambio que pide otro módulo y guarda sus eventos. Es idempotente: si el
 * reporte no existe o ya no admite el cambio (otro evento llegó antes), no hace nada.
 * Devuelve si hubo cambio.
 */
export async function aplicarTransicion(
  deps: DependenciasDeTransicion,
  id: string,
  cambio: (reporte: Reporte, ahora: Date) => void,
): Promise<boolean> {
  const reporte = await deps.reportes.buscarPorId(idReporte(id));
  if (!reporte) return false;
  try {
    cambio(reporte, deps.reloj.ahora());
  } catch (error) {
    if (error instanceof ErrorTransicionInvalida || error instanceof ErrorLimiteDeExtensiones) {
      return false;
    }
    throw error;
  }
  await deps.unidadDeTrabajo.confirmar(reporte, eventosDeIntegracionDe(reporte, deps.ids));
  return true;
}
