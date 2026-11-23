import type { Instantanea, ResumenDeInstantanea } from './instantanea.js';
import type { EstadoDelRegistro, Envio, Transicion, VotoRegistrado } from './registro.js';
import type { Caja, RegistroParaVistas } from './vistas.js';

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
  /**
   * Lo necesario para reconstruir las vistas de la zona en el instante: los envíos de la caja
   * recibidos hasta el instante que pueden aparecer en alguna vista, y las transiciones de sus
   * reportes hasta el instante. Puede traer de más; nunca de menos.
   */
  buscarParaVistas(instante: Date, caja: Caja): Promise<RegistroParaVistas>;
}

/** Instantáneas congeladas. No hay forma de modificarlas ni de borrarlas. */
export interface RepositorioDeInstantaneas {
  /** @throws {ErrorConflicto} con código `NOMBRE_REPETIDO` si ya hay una con ese nombre. */
  guardar(instantanea: Instantanea): Promise<void>;
  listar(): Promise<readonly ResumenDeInstantanea[]>;
  buscarPorId(id: string): Promise<Instantanea | null>;
}
