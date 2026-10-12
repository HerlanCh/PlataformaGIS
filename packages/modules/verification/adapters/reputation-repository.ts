import type { Executor } from '@gis/platform';
import { userId } from '@gis/shared-kernel';
import type { UserId } from '@gis/shared-kernel';
import { eq, sql } from 'drizzle-orm';
import type { ReputationRepository } from '../domain/ports.js';
import { Reputation } from '../domain/reputation.js';
import { reputations } from './schema.js';

type Fila = typeof reputations.$inferSelect;

/** Mapeo explícito fila → entidad: el dominio nunca ve tipos de Drizzle. */
const aEntidad = (fila: Fila): Reputation =>
  Reputation.restore({
    userId: userId(fila.userId),
    score: fila.score,
    lastPenaltyAt: fila.lastPenaltyAt,
  });

export class PgReputationRepository implements ReputationRepository {
  constructor(private readonly db: Executor) {}

  async findByUser(id: UserId): Promise<Reputation | null> {
    const [fila] = await this.db
      .select()
      .from(reputations)
      .where(eq(reputations.userId, id))
      .limit(1);
    return fila ? aEntidad(fila) : null;
  }

  async save(reputation: Reputation): Promise<void> {
    const mutables = {
      score: reputation.score,
      lastPenaltyAt: reputation.lastPenaltyAt,
      updatedAt: sql`now()`,
    };
    await this.db
      .insert(reputations)
      .values({ userId: reputation.userId, ...mutables })
      .onConflictDoUpdate({ target: reputations.userId, set: mutables });
  }
}
