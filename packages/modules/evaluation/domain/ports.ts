import type { EstadoDelRegistro, Envio, Transicion, VotoRegistrado } from './registro.js';

/**
 * Registro de la evaluación. Cada escritura es idempotente: repetir un envío (por su ID) o una
 * transición o un voto (por el ID de su evento) no cambia nada, así un evento que el outbox
 * entrega dos veces no se cuenta dos veces.
 */
export interface RepositorioDeEvaluacion {
  registrarEnvio(envio: Envio): Promise<void>;
  registrarTransicion(transicion: Transicion): Promise<void>;
  registrarVoto(voto: VotoRegistrado): Promise<void>;
  estado(): Promise<EstadoDelRegistro>;
}
