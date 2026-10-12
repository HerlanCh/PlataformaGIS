import type { IdUsuario } from '@gis/shared-kernel';
import type { Voto, ValorVoto } from './vote.js';

/** Ajustes de reputación (SRS 3.2.6). */
export const AJUSTES_DE_REPUTACION = {
  /** Al autor, cuando su reporte se confirma. */
  reporteConfirmado: 0.2,
  /** Al autor, cuando un moderador rechaza su reporte. */
  reporteRechazado: 0.5,
  /** Al votante, cuando su voto coincide con el desenlace. */
  votoAcertado: 0.05,
} as const;

/** Desenlaces de un reporte que premian a quienes votaron en ese sentido. */
export type DesenlaceVotado = 'CONFIRMADO' | 'RESUELTO';

export type MotivoRechazo = 'MODERACION' | 'AUTOR_SILENCIADO';

const VOTO_ACERTADO: Record<DesenlaceVotado, ValorVoto> = {
  CONFIRMADO: 'CONFIRMACION',
  RESUELTO: 'NEGACION',
};

export const PoliticaDeReputacion = {
  /**
   * Penalización al autor de un reporte rechazado. El rechazo automático por
   * autor silenciado no vuelve a penalizar (SRS 3.2.7).
   */
  penalizacionPorRechazo(motivo: MotivoRechazo): number {
    return motivo === 'MODERACION' ? AJUSTES_DE_REPUTACION.reporteRechazado : 0;
  },

  /**
   * Votantes que acertaron: confirmaron un reporte que llegó a `CONFIRMADO` o lo
   * negaron y llegó a `RESUELTO`. Los votos de peso 0 no se premian.
   */
  votantesAcertados(votos: readonly Voto[], desenlace: DesenlaceVotado): IdUsuario[] {
    return votos
      .filter((vote) => vote.valor === VOTO_ACERTADO[desenlace] && vote.peso > 0)
      .map((vote) => vote.idVotante);
  },
};
