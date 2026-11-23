import type { EnvioEtiquetable, Etiqueta, Evaluador } from './etiquetado.js';
import type { Instantanea, ResumenDeInstantanea } from './instantanea.js';
import type { EstadoDelRegistro, Envio, Transicion, VotoRegistrado } from './registro.js';
import type { CierreDeTarea, Sesion } from './tarea.js';
import type { ReporteVerificable, Verificacion } from './verificacion.js';
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
  /** Envíos de la comunidad recibidos en `[desde, hasta)`, salvo los de un reporte rechazado. */
  buscarEnviosEtiquetables(desde: Date, hasta: Date): Promise<readonly EnvioEtiquetable[]>;
  /** Reportes de la comunidad creados en `[desde, hasta)` y no rechazados, con si se confirmaron. */
  buscarReportesVerificables(desde: Date, hasta: Date): Promise<readonly ReporteVerificable[]>;
}

/** Instantáneas congeladas. No hay forma de modificarlas ni de borrarlas. */
export interface RepositorioDeInstantaneas {
  /** @throws {ErrorConflicto} con código `NOMBRE_REPETIDO` si ya hay una con ese nombre. */
  guardar(instantanea: Instantanea): Promise<void>;
  listar(): Promise<readonly ResumenDeInstantanea[]>;
  buscarPorId(id: string): Promise<Instantanea | null>;
  buscarIdPorNombre(nombre: string): Promise<string | null>;
}

/** Sesiones de la tarea cronometrada. */
export interface RepositorioDeSesiones {
  /** @throws {ErrorConflicto} con código `PARTICIPANTE_REPETIDO` si el código ya tiene sesión. */
  crear(sesion: Sesion): Promise<void>;
  listar(): Promise<readonly Sesion[]>;
  buscarPorTarea(idTarea: string): Promise<Sesion | null>;
  /** Marca el inicio si la tarea aún no empezó. Devuelve si la marcó. */
  iniciar(idTarea: string, en: Date): Promise<boolean>;
  /** Guarda el cierre y las marcas si la tarea aún no terminó. Devuelve si lo guardó. */
  cerrar(idTarea: string, cierre: CierreDeTarea): Promise<boolean>;
}

/** Una asignación de envío a grupo; `grupo` nulo quita la etiqueta. */
export interface Asignacion {
  readonly idEnvio: string;
  readonly grupo: string | null;
}

export interface RepositorioDeEtiquetas {
  guardar(evaluador: Evaluador, asignaciones: readonly Asignacion[]): Promise<void>;
  buscar(idsEnvio: readonly string[]): Promise<readonly Etiqueta[]>;
}

export interface RepositorioDeVerificaciones {
  /** Alta o corrección: la última registrada reemplaza a la anterior. */
  guardar(verificacion: Verificacion): Promise<void>;
  listar(): Promise<readonly Verificacion[]>;
}

/** Fuente de azar del sorteo: un número en `[0, 1)`. */
export type Azar = () => number;
