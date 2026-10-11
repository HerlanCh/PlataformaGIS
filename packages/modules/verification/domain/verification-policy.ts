import type { ReportSnapshot } from './report-snapshot.js';
import type { Vote, VoteValue } from './vote.js';

/** Umbrales de verificación (SRS 3.2.3 a 3.2.5). */
export const VERIFICATION = {
  /** Suma ponderada de confirmaciones para pasar a `CONFIRMADO`. */
  confirmThreshold: 3.0,
  /** Suma ponderada de confirmaciones para la segunda extensión de vigencia. */
  extendThreshold: 6.0,
  /** Suma ponderada de negaciones para pasar a `RESUELTO`. */
  resolveThreshold: 3.0,
  /** Votantes distintos exigidos para confirmar o resolver. */
  minDistinctVoters: 2,
  /** Extensiones de vigencia permitidas por reporte. */
  maxExtensions: 2,
} as const;

/** Lo que `verification` pide a `reports` que aplique. Nunca modifica el reporte por sí mismo. */
export type Decision = 'NONE' | 'CONFIRM' | 'EXTEND' | 'RESOLVE';

export interface Tally {
  readonly weight: number;
  /** Votantes con peso mayor que cero. Hay un voto por usuario y reporte. */
  readonly voters: number;
}

// Dos decimales: las reputaciones avanzan en pasos de 0,05 y la suma en coma flotante puede desviarse.
const redondear = (valor: number): number => Math.round(valor * 100) / 100;

const alcanza = (conteo: Tally, umbral: number): boolean =>
  conteo.weight >= umbral && conteo.voters >= VERIFICATION.minDistinctVoters;

export const VerificationPolicy = {
  /** Suma ponderada y votantes de un sentido. Los votos de peso 0 (silenciados) no cuentan. */
  tally(votes: readonly Vote[], value: VoteValue): Tally {
    const validos = votes.filter((vote) => vote.value === value && vote.weight > 0);
    return {
      weight: redondear(validos.reduce((suma, vote) => suma + vote.weight, 0)),
      voters: validos.length,
    };
  },

  /**
   * Decide qué hacer con un reporte a partir de todos sus votos.
   * Las negaciones tienen prioridad: un incidente despejado no debe seguir en el mapa.
   */
  decide(report: Pick<ReportSnapshot, 'status' | 'extensions'>, votes: readonly Vote[]): Decision {
    if (report.status !== 'ACTIVO' && report.status !== 'CONFIRMADO') return 'NONE';

    if (alcanza(this.tally(votes, 'NEGACION'), VERIFICATION.resolveThreshold)) return 'RESOLVE';

    const confirmaciones = this.tally(votes, 'CONFIRMACION');
    if (report.status === 'ACTIVO') {
      return alcanza(confirmaciones, VERIFICATION.confirmThreshold) ? 'CONFIRM' : 'NONE';
    }

    const puedeExtender = report.extensions < VERIFICATION.maxExtensions;
    return puedeExtender && alcanza(confirmaciones, VERIFICATION.extendThreshold)
      ? 'EXTEND'
      : 'NONE';
  },
};
