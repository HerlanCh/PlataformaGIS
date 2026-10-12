import type { InstantaneaDeReporte } from './report-snapshot.js';
import type { Voto, ValorVoto } from './vote.js';

/** Umbrales de verificación (SRS 3.2.3 a 3.2.5). */
export const VERIFICACION = {
  /** Suma ponderada de confirmaciones para pasar a `CONFIRMADO`. */
  umbralDeConfirmacion: 3.0,
  /** Suma ponderada de confirmaciones para la segunda extensión de vigencia. */
  umbralDeExtension: 6.0,
  /** Suma ponderada de negaciones para pasar a `RESUELTO`. */
  umbralDeResolucion: 3.0,
  /** Votantes distintos exigidos para confirmar o resolver. */
  minVotantesDistintos: 2,
  /** Extensiones de vigencia permitidas por reporte. */
  maxExtensiones: 2,
} as const;

/** Lo que `verification` pide a `reports` que aplique. Nunca modifica el reporte por sí mismo. */
export type Decision = 'NINGUNA' | 'CONFIRMAR' | 'EXTENDER' | 'RESOLVER';

export interface Conteo {
  readonly peso: number;
  /** Votantes con peso mayor que cero. Hay un voto por usuario y reporte. */
  readonly votantes: number;
}

// Dos decimales: las reputaciones avanzan en pasos de 0,05 y la suma en coma flotante puede desviarse.
const redondear = (valor: number): number => Math.round(valor * 100) / 100;

const alcanza = (conteo: Conteo, umbral: number): boolean =>
  conteo.peso >= umbral && conteo.votantes >= VERIFICACION.minVotantesDistintos;

export const PoliticaDeVerificacion = {
  /** Suma ponderada y votantes de un sentido. Los votos de peso 0 (silenciados) no cuentan. */
  contar(votos: readonly Voto[], valor: ValorVoto): Conteo {
    const validos = votos.filter((vote) => vote.valor === valor && vote.peso > 0);
    return {
      peso: redondear(validos.reduce((suma, vote) => suma + vote.peso, 0)),
      votantes: validos.length,
    };
  },

  /**
   * Decide qué hacer con un reporte a partir de todos sus votos.
   * Las negaciones tienen prioridad: un incidente despejado no debe seguir en el mapa.
   */
  decidir(
    reporte: Pick<InstantaneaDeReporte, 'estado' | 'extensiones'>,
    votos: readonly Voto[],
  ): Decision {
    if (reporte.estado !== 'ACTIVO' && reporte.estado !== 'CONFIRMADO') return 'NINGUNA';

    if (alcanza(this.contar(votos, 'NEGACION'), VERIFICACION.umbralDeResolucion)) return 'RESOLVER';

    const confirmaciones = this.contar(votos, 'CONFIRMACION');
    if (reporte.estado === 'ACTIVO') {
      return alcanza(confirmaciones, VERIFICACION.umbralDeConfirmacion) ? 'CONFIRMAR' : 'NINGUNA';
    }

    const puedeExtender = reporte.extensiones < VERIFICACION.maxExtensiones;
    return puedeExtender && alcanza(confirmaciones, VERIFICACION.umbralDeExtension)
      ? 'EXTENDER'
      : 'NINGUNA';
  },
};
