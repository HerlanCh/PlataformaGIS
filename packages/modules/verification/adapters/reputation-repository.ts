import type { Ejecutor } from '@gis/platform';
import { idUsuario } from '@gis/shared-kernel';
import type { IdUsuario } from '@gis/shared-kernel';
import { eq, sql } from 'drizzle-orm';
import type { RepositorioDeReputaciones } from '../domain/ports.js';
import { Reputacion } from '../domain/reputation.js';
import { reputaciones } from './schema.js';

type Fila = typeof reputaciones.$inferSelect;

/** Mapeo explícito fila → entidad: el dominio nunca ve tipos de Drizzle. */
const aEntidad = (fila: Fila): Reputacion =>
  Reputacion.restaurar({
    idUsuario: idUsuario(fila.idUsuario),
    puntaje: fila.puntaje,
    ultimaPenalizacionEn: fila.ultimaPenalizacionEn,
  });

export class RepositorioReputacionesPg implements RepositorioDeReputaciones {
  constructor(private readonly db: Ejecutor) {}

  async buscarPorUsuario(id: IdUsuario): Promise<Reputacion | null> {
    const [fila] = await this.db
      .select()
      .from(reputaciones)
      .where(eq(reputaciones.idUsuario, id))
      .limit(1);
    return fila ? aEntidad(fila) : null;
  }

  async guardar(reputacion: Reputacion): Promise<void> {
    const mutables = {
      puntaje: reputacion.puntaje,
      ultimaPenalizacionEn: reputacion.ultimaPenalizacionEn,
      actualizadoEn: sql`now()`,
    };
    await this.db
      .insert(reputaciones)
      .values({ idUsuario: reputacion.idUsuario, ...mutables })
      .onConflictDoUpdate({ target: reputaciones.idUsuario, set: mutables });
  }
}
