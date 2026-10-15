/**
 * Percentil por el método del rango más cercano: el menor valor que deja al menos
 * `porcentaje` % de las muestras en o por debajo de él.
 * @throws {RangeError} si no hay muestras o el porcentaje no está entre 0 y 100.
 */
export function percentil(muestras: readonly number[], porcentaje: number): number {
  if (muestras.length === 0) throw new RangeError('No hay muestras');
  if (!(porcentaje > 0 && porcentaje <= 100)) {
    throw new RangeError('El porcentaje debe ser mayor que 0 y como máximo 100');
  }
  const ordenadas = [...muestras].sort((a, b) => a - b);
  const posicion = Math.ceil((porcentaje / 100) * ordenadas.length) - 1;
  return ordenadas[posicion]!;
}

/** Nodos de un plan de PostgreSQL que recorren una tabla completa. */
const RECORRIDO_COMPLETO = /(?:Parallel )?Seq Scan on (\w+)/g;
const USO_DE_INDICE = /(?:Index Scan|Index Only Scan|Bitmap Index Scan)/;

export interface LecturaDelPlan {
  readonly usaIndice: boolean;
  /** Tablas que el plan recorre completas. */
  readonly recorridosCompletos: readonly string[];
}

/** Lee un plan de `EXPLAIN` en texto: si usa algún índice y qué tablas recorre completas. */
export function leerPlan(plan: string): LecturaDelPlan {
  const recorridosCompletos = [...plan.matchAll(RECORRIDO_COMPLETO)].map((m) => m[1]!);
  return {
    usaIndice: USO_DE_INDICE.test(plan),
    recorridosCompletos: [...new Set(recorridosCompletos)],
  };
}
