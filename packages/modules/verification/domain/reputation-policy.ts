import type { UserId } from '@gis/shared-kernel';
import type { Vote, VoteValue } from './vote.js';

/** Ajustes de reputación (SRS 3.2.6). */
export const REPUTATION_ADJUSTMENTS = {
  /** Al autor, cuando su reporte se confirma. */
  reportConfirmed: 0.2,
  /** Al autor, cuando un moderador rechaza su reporte. */
  reportRejected: 0.5,
  /** Al votante, cuando su voto coincide con el desenlace. */
  accurateVote: 0.05,
} as const;

/** Desenlaces de un reporte que premian a quienes votaron en ese sentido. */
export type VotedOutcome = 'CONFIRMADO' | 'RESUELTO';

export type RejectionReason = 'MODERACION' | 'AUTOR_SILENCIADO';

const VOTO_ACERTADO: Record<VotedOutcome, VoteValue> = {
  CONFIRMADO: 'CONFIRMACION',
  RESUELTO: 'NEGACION',
};

export const ReputationPolicy = {
  /**
   * Penalización al autor de un reporte rechazado. El rechazo automático por
   * autor silenciado no vuelve a penalizar (SRS 3.2.7).
   */
  penaltyForRejection(reason: RejectionReason): number {
    return reason === 'MODERACION' ? REPUTATION_ADJUSTMENTS.reportRejected : 0;
  },

  /**
   * Votantes que acertaron: confirmaron un reporte que llegó a `CONFIRMADO` o lo
   * negaron y llegó a `RESUELTO`. Los votos de peso 0 no se premian.
   */
  accurateVoters(votes: readonly Vote[], outcome: VotedOutcome): UserId[] {
    return votes
      .filter((vote) => vote.value === VOTO_ACERTADO[outcome] && vote.weight > 0)
      .map((vote) => vote.voterId);
  },
};
