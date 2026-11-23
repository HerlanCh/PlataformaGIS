/**
 * Verificación (ADR-007): la referencia independiente de veracidad y de hora de fin, comprobada en
 * campo o con fuentes secundarias, nunca con los votos de la plataforma.
 */

export type ResultadoDeVerificacion = 'REAL' | 'FALSO' | 'NO_VERIFICABLE';

export type FuenteDeVerificacion = 'CAMPO' | 'SECUNDARIA';

/** El detalle de la fuente es breve y nunca describe a personas. */
export const MAX_DETALLE_DE_FUENTE = 200;

/** Reportes que el sorteo propone por categoría y grupo (confirmados y no confirmados). */
export const POR_GRUPO_DEL_SORTEO = 5;

export interface Verificacion {
  readonly idReporte: string;
  readonly resultado: ResultadoDeVerificacion;
  /** Cuándo dejó de ser cierto; nulo si no se sabe o si fue falso. */
  readonly finEn: Date | null;
  readonly fuente: FuenteDeVerificacion;
  readonly detalleFuente: string | null;
  readonly registradaEn: Date;
}

/** Un reporte de la comunidad del periodo, candidato al sorteo. */
export interface ReporteVerificable {
  readonly idReporte: string;
  readonly codigoCategoria: string;
  readonly publicLocation: { readonly latitud: number; readonly longitud: number };
  readonly creadoEn: Date;
  /** Si llegó alguna vez a `CONFIRMADO`. */
  readonly confirmado: boolean;
}

export interface Sorteo {
  readonly confirmados: readonly ReporteVerificable[];
  readonly noConfirmados: readonly ReporteVerificable[];
}

/** Toma `cantidad` elementos al azar sin repetir (Fisher-Yates parcial). */
function tomarAlAzar<T>(elementos: readonly T[], cantidad: number, azar: () => number): T[] {
  const copia = [...elementos];
  const tomados: T[] = [];
  while (tomados.length < cantidad && copia.length > 0) {
    const indice = Math.floor(azar() * copia.length);
    tomados.push(...copia.splice(indice, 1));
  }
  return tomados;
}

/**
 * Sorteo semanal del protocolo: por cada categoría, hasta 5 alertas confirmadas y 5 reportes no
 * confirmados, al azar. `azar` devuelve un número en `[0, 1)`.
 */
export function sortear(reportes: readonly ReporteVerificable[], azar: () => number): Sorteo {
  const categorias = [...new Set(reportes.map((r) => r.codigoCategoria))].toSorted();
  const confirmados: ReporteVerificable[] = [];
  const noConfirmados: ReporteVerificable[] = [];
  for (const categoria of categorias) {
    const deLaCategoria = reportes.filter((r) => r.codigoCategoria === categoria);
    confirmados.push(
      ...tomarAlAzar(
        deLaCategoria.filter((r) => r.confirmado),
        POR_GRUPO_DEL_SORTEO,
        azar,
      ),
    );
    noConfirmados.push(
      ...tomarAlAzar(
        deLaCategoria.filter((r) => !r.confirmado),
        POR_GRUPO_DEL_SORTEO,
        azar,
      ),
    );
  }
  return { confirmados, noConfirmados };
}
