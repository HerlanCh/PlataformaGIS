import type { EventoDeIntegracion } from '@gis/contracts';
import type { AccionDeModeracion } from '../domain/accion-de-moderacion.js';

/**
 * Guarda la auditoría y sus eventos en una sola transacción (patrón outbox). Toda decisión de un
 * moderador saca además el reporte de la cola, en la misma transacción.
 */
export interface UnidadDeTrabajoDeModeracion {
  registrar(accion: AccionDeModeracion, eventos: readonly EventoDeIntegracion[]): Promise<void>;
}
