import type { EventoDeIntegracion } from '@gis/contracts';
import { agregarASalida } from '@gis/platform';
import type { Db } from '@gis/platform';
import type { UnidadDeTrabajoDeModeracion } from '../application/ports.js';
import type { AccionDeModeracion } from '../domain/accion-de-moderacion.js';
import { and, eq, isNull } from 'drizzle-orm';
import { accionesModeracion, colaModeracion } from './schema.js';

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
      // Toda decisión saca el reporte de la cola.
      await tx
        .update(colaModeracion)
        .set({ resueltoEn: accion.creadoEn })
        .where(
          and(eq(colaModeracion.idReporte, accion.idReporte), isNull(colaModeracion.resueltoEn)),
        );
      await agregarASalida(tx, eventos);
    });
  }
}
