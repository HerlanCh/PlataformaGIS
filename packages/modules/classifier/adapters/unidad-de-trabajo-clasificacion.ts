import type { EventoDeIntegracion } from '@gis/contracts';
import { agregarASalida } from '@gis/platform';
import type { Db } from '@gis/platform';
import type { UnidadDeTrabajoDeClasificacion } from '../application/ports.js';
import type { RegistroDeClasificacion } from '../domain/clasificacion.js';
import { clasificaciones } from './schema.js';

export class UnidadDeTrabajoClasificacionPg implements UnidadDeTrabajoDeClasificacion {
  constructor(private readonly db: Db) {}

  async registrar(
    clasificacion: RegistroDeClasificacion,
    eventos: readonly EventoDeIntegracion[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(clasificaciones).values({
        id: clasificacion.id,
        idReporte: clasificacion.idReporte,
        sospechoso: clasificacion.sospechoso,
        motivos: [...clasificacion.motivos],
        puntaje: clasificacion.puntaje,
        clasificador: clasificacion.clasificador,
        creadoEn: clasificacion.creadoEn,
      });
      await agregarASalida(tx, eventos);
    });
  }
}
