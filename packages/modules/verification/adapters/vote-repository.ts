import type { Ejecutor } from '@gis/platform';
import { idReporte, idUsuario } from '@gis/shared-kernel';
import type { IdReporte, IdUsuario } from '@gis/shared-kernel';
import { and, asc, eq } from 'drizzle-orm';
import { ErrorYaVoto } from '../domain/errors.js';
import type { RepositorioDeVotos } from '../domain/ports.js';
import { Voto } from '../domain/vote.js';
import type { ValorVoto } from '../domain/vote.js';
import { votos } from './schema.js';

type Fila = typeof votos.$inferSelect;

/** Código de PostgreSQL para una violación de clave única o primaria. */
const CLAVE_DUPLICADA = '23505';

const esClaveDuplicada = (error: unknown): boolean => {
  const causa = error instanceof Error ? error.cause : undefined;
  return [error, causa].some(
    (e) => (e as { code?: unknown } | undefined)?.code === CLAVE_DUPLICADA,
  );
};

/** Mapeo explícito fila → entidad: el dominio nunca ve tipos de Drizzle. */
const aEntidad = (fila: Fila): Voto =>
  Voto.restaurar({
    idReporte: idReporte(fila.idReporte),
    idVotante: idUsuario(fila.idUsuario),
    valor: fila.valor as ValorVoto,
    peso: fila.peso,
    emitidoEn: fila.creadoEn,
  });

export class RepositorioVotosPg implements RepositorioDeVotos {
  constructor(private readonly db: Ejecutor) {}

  async buscarPorReporte(id: IdReporte): Promise<readonly Voto[]> {
    const filas = await this.db
      .select()
      .from(votos)
      .where(eq(votos.idReporte, id))
      .orderBy(asc(votos.creadoEn), asc(votos.idUsuario));
    return filas.map(aEntidad);
  }

  async existe(id: IdReporte, idVotante: IdUsuario): Promise<boolean> {
    const filas = await this.db
      .select({ idUsuario: votos.idUsuario })
      .from(votos)
      .where(and(eq(votos.idReporte, id), eq(votos.idUsuario, idVotante)))
      .limit(1);
    return filas.length > 0;
  }

  /**
   * Un voto es inmutable: solo se inserta. La clave primaria cubre el caso de dos
   * votos simultáneos del mismo usuario, que `existe` no puede detectar.
   * @throws {ErrorYaVoto} si el usuario ya votó sobre ese reporte.
   */
  async guardar(voto: Voto): Promise<void> {
    try {
      await this.db.insert(votos).values({
        idReporte: voto.idReporte,
        idUsuario: voto.idVotante,
        valor: voto.valor,
        peso: voto.peso,
        creadoEn: voto.emitidoEn,
      });
    } catch (error) {
      if (esClaveDuplicada(error)) throw new ErrorYaVoto();
      throw error;
    }
  }
}
