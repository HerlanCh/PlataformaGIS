import type { GeoPoint, ReportId, UserId } from '@gis/shared-kernel';
import {
  AlreadyVotedError,
  AuthorCannotVoteError,
  ReportNotActiveError,
  TooFarToVoteError,
} from './errors.js';
import type { ReportSnapshot } from './report-snapshot.js';
import type { Reputation } from './reputation.js';

export type VoteValue = 'CONFIRMACION' | 'NEGACION';

/** Distancia máxima entre el votante y la ubicación real del reporte (SRS 3.2.2). */
export const MAX_VOTE_DISTANCE_M = 1000;

export interface VoteProps {
  readonly reportId: ReportId;
  readonly voterId: UserId;
  readonly value: VoteValue;
  /** Reputación del votante en el momento de votar. */
  readonly weight: number;
  readonly castAt: Date;
}

export interface CastVoteInput {
  readonly report: ReportSnapshot;
  readonly voter: Reputation;
  readonly voterLocation: GeoPoint;
  readonly value: VoteValue;
  /** Si el votante ya tiene un voto sobre este reporte. */
  readonly alreadyVoted: boolean;
  readonly now: Date;
}

const VIGENTES: readonly ReportSnapshot['status'][] = ['ACTIVO', 'CONFIRMADO'];

/** Voto de un usuario sobre un reporte ("¿Sigue ahí?"). Inmutable. */
export class Vote {
  readonly reportId: ReportId;
  readonly voterId: UserId;
  readonly value: VoteValue;
  readonly weight: number;
  readonly castAt: Date;

  private constructor(props: VoteProps) {
    this.reportId = props.reportId;
    this.voterId = props.voterId;
    this.value = props.value;
    this.weight = props.weight;
    this.castAt = props.castAt;
    Object.freeze(this);
  }

  /**
   * Emite un voto aplicando las reglas del SRS 3.2.2. El voto de un usuario
   * silenciado se registra con peso 0.
   * @throws {ReportNotActiveError} si el reporte ya no está vigente.
   * @throws {AuthorCannotVoteError} si el votante es el autor.
   * @throws {AlreadyVotedError} si ya votó sobre este reporte.
   * @throws {TooFarToVoteError} si está a más de 1000 m.
   */
  static cast(input: CastVoteInput): Vote {
    const { report, voter, voterLocation, value, alreadyVoted, now } = input;

    if (!VIGENTES.includes(report.status)) throw new ReportNotActiveError();
    if (voter.userId === report.authorId) throw new AuthorCannotVoteError();
    if (alreadyVoted) throw new AlreadyVotedError();
    if (voterLocation.distanceTo(report.location) > MAX_VOTE_DISTANCE_M) {
      throw new TooFarToVoteError(MAX_VOTE_DISTANCE_M);
    }

    return new Vote({
      reportId: report.id,
      voterId: voter.userId,
      value,
      weight: voter.score,
      castAt: now,
    });
  }

  /** Reconstruye un voto ya persistido. */
  static restore(props: VoteProps): Vote {
    return new Vote(props);
  }
}
