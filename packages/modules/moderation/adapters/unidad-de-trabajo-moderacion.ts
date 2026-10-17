import type { EventoDeIntegracion } from '@gis/contracts';
import { agregarASalida } from '@gis/platform';
import type { Db } from '@gis/platform';
import type { UnidadDeTrabajoDeModeracion } from '../application/ports.js';
import type { AccionDeModeracion } from '../domain/accion-de-moderacion.js';
import { accionesModeracion } from './schema.js';

export class UnidadDeTrabajoModeracionPg implements UnidadDeTrabajoDeModeracion {
  constructor(private readonly db: Db) {}

  async registrar(
    accion: AccionDeModeracion,
    eventos: readonly EventoDeIntegracion[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(accionesModeracion).values({
        id: accion.id,
        idReporte: accion.idReporte,
        idModerador: accion.idModerador,
        accion: accion.accion,
        motivo: accion.motivo,
        creadoEn: accion.creadoEn,
      });
      await agregarASalida(tx, eventos);
    });
  }
}
