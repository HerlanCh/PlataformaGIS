import type { UserId } from '@gis/shared-kernel';

/** Parámetros de reputación (SRS 3.2.1 y 3.2.7). */
export const REPUTATION = {
  initial: 1.0,
  min: 0.0,
  max: 5.0,
  /** Reputación con la que vuelve un usuario silenciado. */
  recovered: 0.5,
  /** Días sin penalización tras los que un silenciado se recupera. */
  recoveryDays: 30,
} as const;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Dos decimales: evita que la suma repetida de 0,05 acumule error de coma flotante.
const redondear = (valor: number): number => Math.round(valor * 100) / 100;
const acotar = (valor: number): number => Math.min(REPUTATION.max, Math.max(REPUTATION.min, valor));

export interface ReputationProps {
  readonly userId: UserId;
  readonly score: number;
  readonly lastPenaltyAt: Date | null;
}

/** Reputación de un usuario. Determina el peso de sus votos. */
export class Reputation {
  private constructor(private props: ReputationProps) {}

  /** Reputación base de todo usuario nuevo. */
  static initial(userId: UserId): Reputation {
    return new Reputation({ userId, score: REPUTATION.initial, lastPenaltyAt: null });
  }

  /** Reconstruye una reputación ya persistida. */
  static restore(props: ReputationProps): Reputation {
    return new Reputation(props);
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get score(): number {
    return this.props.score;
  }

  get lastPenaltyAt(): Date | null {
    return this.props.lastPenaltyAt;
  }

  /** Silenciado: sus votos no cuentan y sus reportes se rechazan de inmediato. */
  get isSilenced(): boolean {
    return this.props.score === REPUTATION.min;
  }

  /** Suma reputación, hasta el máximo. Un usuario silenciado no gana reputación: solo se recupera con el tiempo. */
  reward(amount: number): void {
    if (this.isSilenced) return;
    this.props = { ...this.props, score: acotar(redondear(this.props.score + amount)) };
  }

  /** Resta reputación, hasta el mínimo, y anota la fecha para el plazo de recuperación. */
  penalize(amount: number, now: Date): void {
    this.props = {
      ...this.props,
      score: acotar(redondear(this.props.score - amount)),
      lastPenaltyAt: now,
    };
  }

  /**
   * Devuelve la reputación a 0.5 si el usuario está silenciado y pasaron 30 días
   * desde su última penalización. Indica si hubo recuperación.
   */
  recoverIfDue(now: Date): boolean {
    const { lastPenaltyAt } = this.props;
    if (!this.isSilenced || lastPenaltyAt === null) return false;

    const plazo = lastPenaltyAt.getTime() + REPUTATION.recoveryDays * MS_POR_DIA;
    if (now.getTime() < plazo) return false;

    this.props = { ...this.props, score: REPUTATION.recovered };
    return true;
  }
}
