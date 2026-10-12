import type { IdUsuario } from '@gis/shared-kernel';
import type { IdSuscripcion, ZonaSuscrita } from './zone-subscription.js';

/** La búsqueda de zonas que contienen un punto (para notificar) se añade en la Fase 4. */
export interface RepositorioDeSuscripciones {
  buscarPorId(id: IdSuscripcion): Promise<ZonaSuscrita | null>;
  buscarPorUsuario(idUsuario: IdUsuario): Promise<readonly ZonaSuscrita[]>;
  guardar(zona: ZonaSuscrita): Promise<void>;
  /** Indica si la zona existía. */
  eliminar(id: IdSuscripcion): Promise<boolean>;
}
