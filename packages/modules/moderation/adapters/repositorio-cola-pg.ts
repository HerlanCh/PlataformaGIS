import type { Ejecutor } from '@gis/platform';
import { idReporte } from '@gis/shared-kernel';
import type { IdReporte } from '@gis/shared-kernel';
import { and, asc, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { CasoDeModeracion } from '../domain/caso-de-moderacion.js';
import type { RepositorioDeCola } from '../domain/ports.js';
import { colaModeracion } from './schema.js';

type Fila = typeof colaModeracion.$inferSelect;

const aCaso = (fila: Fila): CasoDeModeracion =>
  CasoDeModeracion.restaurar({
    idReporte: idReporte(fila.idReporte),
    negaciones: fila.negaciones,
    marcado: fila.marcado,
    motivos: fila.motivos,
    actualizadoEn: fila.actualizadoEn,
    resueltoEn: fila.resueltoEn,
  });

export class RepositorioColaPg implements RepositorioDeCola {
  constructor(private readonly db: Ejecutor) {}

  async buscar(id: IdReporte): Promise<CasoDeModeracion | null> {
    const [fila] = await this.db
      .select()
      .from(colaModeracion)
      .where(eq(colaModeracion.idReporte, id))
      .limit(1);
    return fila ? aCaso(fila) : null;
  }

  async guardar(caso: CasoDeModeracion): Promise<void> {
    const mutables = {
      negaciones: caso.negaciones,
      marcado: caso.marcado,
      motivos: [...caso.motivos],
      actualizadoEn: caso.actualizadoEn,
      resueltoEn: caso.resueltoEn,
    };
    await this.db
      .insert(colaModeracion)
      .values({ idReporte: caso.idReporte, ...mutables })
      .onConflictDoUpdate({ target: colaModeracion.idReporte, set: mutables });
  }

  async listarPendientes(limite: number): Promise<readonly CasoDeModeracion[]> {
    const filas = await this.db
      .select()
      .from(colaModeracion)
      .where(
        and(
          isNull(colaModeracion.resueltoEn),
          or(eq(colaModeracion.marcado, true), gt(colaModeracion.negaciones, 0)),
        ),
      )
      .orderBy(
        desc(colaModeracion.marcado),
        desc(colaModeracion.negaciones),
        asc(colaModeracion.actualizadoEn),
      )
      .limit(limite);
    return filas.map(aCaso);
  }
}
