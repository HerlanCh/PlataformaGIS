/** Puerto de tiempo: el dominio nunca llama a `new Date()` directamente. */
export interface Clock {
  now(): Date;
}
