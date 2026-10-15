import type { CodigoCategoria, IdUsuario, PuntoGeo } from '@gis/shared-kernel';
import type { IdSuscripcion, ZonaSuscrita } from './zone-subscription.js';

export interface RepositorioDeSuscripciones {
  buscarPorId(id: IdSuscripcion): Promise<ZonaSuscrita | null>;
  buscarPorUsuario(idUsuario: IdUsuario): Promise<readonly ZonaSuscrita[]>;
  guardar(zona: ZonaSuscrita): Promise<void>;
  /** Indica si la zona existía. */
  eliminar(id: IdSuscripcion): Promise<boolean>;
  /**
   * Zonas cuyo círculo contiene el punto y que eligieron la categoría, de la más antigua a la
   * más reciente. Sirve para decidir a quién notificar un reporte nuevo.
   */
  buscarSuscriptores(punto: PuntoGeo, categoria: CodigoCategoria): Promise<readonly ZonaSuscrita[]>;
}
