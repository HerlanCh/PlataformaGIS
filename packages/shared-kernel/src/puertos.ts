/** Genera identificadores únicos (UUID). Ni el dominio ni la aplicación los crean por sí mismos. */
export interface GeneradorDeId {
  siguiente(): string;
}

export interface ConsumoDeLimite {
  readonly permitido: boolean;
  /** 0 si se permitió; si no, segundos hasta que se libere un cupo. */
  readonly reintentarEnSegundos: number;
}

/**
 * Límite de operaciones por clave en una ventana de tiempo (SRS 3.3). Cada llamada
 * consume un cupo si lo hay.
 */
export interface LimitadorDeFrecuencia {
  consumir(clave: string, limite: number, ventanaSegundos: number): Promise<ConsumoDeLimite>;
}
