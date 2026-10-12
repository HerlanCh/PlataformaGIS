/** Puerto de tiempo: el dominio nunca llama a `new Date()` directamente. */
export interface Reloj {
  ahora(): Date;
}
