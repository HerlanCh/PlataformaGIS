import type { EventoDeIntegracion } from '@gis/contracts';
import type { AccionDeModeracion } from '../domain/accion-de-moderacion.js';

/** Guarda la auditoría y sus eventos en una sola transacción (patrón outbox). */
export interface UnidadDeTrabajoDeModeracion {
  registrar(accion: AccionDeModeracion, eventos: readonly EventoDeIntegracion[]): Promise<void>;
}
