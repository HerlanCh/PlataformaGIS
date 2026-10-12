import type { Executor } from '@gis/platform';
import { reportId, userId } from '@gis/shared-kernel';
import type { ReportId, UserId } from '@gis/shared-kernel';
import { and, asc, eq } from 'drizzle-orm';
import { AlreadyVotedError } from '../domain/errors.js';
import type { VoteRepository } from '../domain/ports.js';
import { Vote } from '../domain/vote.js';
import type { VoteValue } from '../domain/vote.js';
import { votes } from './schema.js';

type Fila = typeof votes.$inferSelect;

/** Código de PostgreSQL para una violación de clave única o primaria. */
const CLAVE_DUPLICADA = '23505';

const esClaveDuplicada = (error: unknown): boolean => {
  const causa = error instanceof Error ? error.cause : undefined;
  return [error, causa].some(
    (e) => (e as { code?: unknown } | undefined)?.code === CLAVE_DUPLICADA,
  );
};

/** Mapeo explícito fila → entidad: el dominio nunca ve tipos de Drizzle. */
const aEntidad = (fila: Fila): Vote =>
  Vote.restore({
    reportId: reportId(fila.reportId),
    voterId: userId(fila.userId),
    value: fila.value as VoteValue,
    weight: fila.weight,
    castAt: fila.createdAt,
  });

export class PgVoteRepository implements VoteRepository {
  constructor(private readonly db: Executor) {}

  async findByReport(id: ReportId): Promise<readonly Vote[]> {
    const filas = await this.db
      .select()
      .from(votes)
      .where(eq(votes.reportId, id))
      .orderBy(asc(votes.createdAt), asc(votes.userId));
    return filas.map(aEntidad);
  }

  async exists(id: ReportId, voterId: UserId): Promise<boolean> {
    const filas = await this.db
      .select({ userId: votes.userId })
      .from(votes)
      .where(and(eq(votes.reportId, id), eq(votes.userId, voterId)))
      .limit(1);
    return filas.length > 0;
  }

  /**
   * Un voto es inmutable: solo se inserta. La clave primaria cubre el caso de dos
   * votos simultáneos del mismo usuario, que `exists` no puede detectar.
   * @throws {AlreadyVotedError} si el usuario ya votó sobre ese reporte.
   */
  async save(vote: Vote): Promise<void> {
    try {
      await this.db.insert(votes).values({
        reportId: vote.reportId,
        userId: vote.voterId,
        value: vote.value,
        weight: vote.weight,
        createdAt: vote.castAt,
      });
    } catch (error) {
      if (esClaveDuplicada(error)) throw new AlreadyVotedError();
      throw error;
    }
  }
}
