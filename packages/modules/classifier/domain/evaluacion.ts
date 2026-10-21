/** Etiqueta de un ejemplo: si un moderador lo habría sacado del mapa. */
export type Etiqueta = 'SOSPECHOSO' | 'NORMAL';

/** Un ejemplo del conjunto etiquetado: la descripción y la decisión correcta. */
export interface Ejemplo {
  readonly texto: string;
  readonly etiqueta: Etiqueta;
}

export interface Metricas {
  readonly verdaderosPositivos: number;
  readonly falsosPositivos: number;
  readonly falsosNegativos: number;
  readonly verdaderosNegativos: number;
  /** De lo marcado, cuánto era sospechoso. `null` si no se marcó nada. */
  readonly precision: number | null;
  /** De lo sospechoso, cuánto se marcó (exhaustividad). `null` si no había sospechosos. */
  readonly exhaustividad: number | null;
  readonly f1: number | null;
}

const cociente = (a: number, b: number): number | null => (b === 0 ? null : a / b);

/** Precisión, exhaustividad y F1 de las predicciones frente a las etiquetas (HU-10). */
export function calcularMetricas(
  resultados: readonly { readonly esperado: Etiqueta; readonly marcado: boolean }[],
): Metricas {
  const cuenta = (esperado: Etiqueta, marcado: boolean) =>
    resultados.filter((r) => r.esperado === esperado && r.marcado === marcado).length;
  const verdaderosPositivos = cuenta('SOSPECHOSO', true);
  const falsosPositivos = cuenta('NORMAL', true);
  const falsosNegativos = cuenta('SOSPECHOSO', false);
  const verdaderosNegativos = cuenta('NORMAL', false);
  const precision = cociente(verdaderosPositivos, verdaderosPositivos + falsosPositivos);
  const exhaustividad = cociente(verdaderosPositivos, verdaderosPositivos + falsosNegativos);
  const f1 =
    precision === null || exhaustividad === null
      ? null
      : cociente(2 * precision * exhaustividad, precision + exhaustividad);
  return {
    verdaderosPositivos,
    falsosPositivos,
    falsosNegativos,
    verdaderosNegativos,
    precision,
    exhaustividad,
    f1,
  };
}

/**
 * Partición estable de prueba: un ejemplo va a la prueba según un hash de su texto, así que la
 * misma frase cae siempre del mismo lado y el modelo de la Fase 13 se mide sobre la misma partición.
 */
export function esDePrueba(texto: string, proporcion = 0.3): boolean {
  let hash = 2166136261;
  for (const caracter of texto) {
    hash ^= caracter.codePointAt(0)!;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 2 ** 32 < proporcion;
}
