import type { IdUsuario } from '@gis/shared-kernel';
import type { SuscripcionPush } from './suscripcion-push.js';

export interface RepositorioDeSuscripcionesPush {
  /** Guarda la suscripción; si su endpoint ya existía, la reemplaza (pasa al usuario actual). */
  guardar(suscripcion: SuscripcionPush): Promise<void>;
  buscarPorUsuario(idUsuario: IdUsuario): Promise<readonly SuscripcionPush[]>;
  /** Elimina por endpoint; con `idUsuario`, solo si es suya. Indica si existía. */
  eliminarPorEndpoint(endpoint: string, idUsuario?: IdUsuario): Promise<boolean>;
}
