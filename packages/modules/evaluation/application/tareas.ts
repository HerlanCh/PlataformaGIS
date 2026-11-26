import { validarEntrada } from '@gis/contracts';
import { ErrorConflicto, ErrorNoEncontrado } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type { Azar, RepositorioDeInstantaneas, RepositorioDeSesiones } from '../domain/ports.js';
import {
  CODIGO_DE_PARTICIPANTE,
  cerrarTarea,
  SECUENCIAS,
  secuenciaEquilibrada,
} from '../domain/tarea.js';
import type { NumeroDeSecuencia, Sesion, Tarea } from '../domain/tarea.js';
import type { PuntoBase, PuntoProcesado } from '../domain/vistas.js';
import { esquemaRol, exigirModerador } from './entradas.js';

export interface DependenciasDeTareas {
  readonly sesiones: RepositorioDeSesiones;
  readonly instantaneas: RepositorioDeInstantaneas;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
  /** Para sortear la secuencia cuando no se indica. */
  readonly azar: Azar;
}

const esquemaCrear = z.object({
  rolActor: esquemaRol,
  codigoParticipante: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CODIGO_DE_PARTICIPANTE, 'El código es P y dos o tres dígitos, nunca un nombre'),
  /** Sin secuencia, se sortea entre las que llevan menos sesiones (perfil v5, 6.3). */
  secuencia: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

export type EntradaCrearSesion = z.input<typeof esquemaCrear>;

/**
 * E1 y E2, que deben estar congeladas y con su clave fijada (perfil v5, 6.3: la respuesta correcta
 * se fija antes de las sesiones).
 * @throws {ErrorConflicto} `FALTAN_INSTANTANEAS` o `FALTA_CLAVE`.
 */
async function escenariosListos(
  instantaneas: RepositorioDeInstantaneas,
): Promise<Readonly<Record<'E1' | 'E2', string>>> {
  const [e1, e2] = await Promise.all([
    instantaneas.buscarIdPorNombre('E1'),
    instantaneas.buscarIdPorNombre('E2'),
  ]);
  if (!e1 || !e2) {
    throw new ErrorConflicto(
      'FALTAN_INSTANTANEAS',
      'Antes de las tareas hay que congelar las instantáneas E1 y E2',
    );
  }
  const claves = await Promise.all([e1, e2].map((id) => instantaneas.buscarPorId(id)));
  if (claves.some((i) => !i || i.clave.length === 0)) {
    throw new ErrorConflicto(
      'FALTA_CLAVE',
      'Los evaluadores deben fijar la clave de E1 y E2 antes de las sesiones',
    );
  }
  return { E1: e1, E2: e2 };
}

/**
 * ADR-007: abre la sesión de un participante con su secuencia contrabalanceada. Sus dos tareas
 * apuntan a las instantáneas `E1` y `E2`.
 */
export class CrearSesion {
  constructor(private readonly deps: DependenciasDeTareas) {}

  /**
   * @throws {ErrorConflicto} `FALTAN_INSTANTANEAS` o `FALTA_CLAVE` si E1 o E2 no están listas, o
   * `PARTICIPANTE_REPETIDO` si el código ya tiene sesión.
   */
  async ejecutar(entrada: EntradaCrearSesion): Promise<Sesion> {
    const datos = validarEntrada(esquemaCrear, entrada);
    exigirModerador(datos.rolActor);
    const instantaneaDe = await escenariosListos(this.deps.instantaneas);
    const secuencia =
      (datos.secuencia as NumeroDeSecuencia | undefined) ??
      secuenciaEquilibrada(
        (await this.deps.sesiones.listar()).map((s) => s.secuencia),
        this.deps.azar,
      );
    const id = this.deps.ids.siguiente();
    const tarea = (orden: 1 | 2): Tarea => {
      const { vista, escenario } = SECUENCIAS[secuencia][orden - 1]!;
      return {
        id: this.deps.ids.siguiente(),
        idSesion: id,
        orden,
        vista,
        escenario,
        idInstantanea: instantaneaDe[escenario],
        iniciadaEn: null,
        terminadaEn: null,
        duracionMs: null,
        agotada: null,
        marcas: [],
      };
    };
    const sesion: Sesion = {
      id,
      codigoParticipante: datos.codigoParticipante,
      secuencia,
      creadaEn: this.deps.reloj.ahora(),
      tareas: [tarea(1), tarea(2)],
    };
    await this.deps.sesiones.crear(sesion);
    return sesion;
  }
}

const esquemaListar = z.object({ rolActor: esquemaRol });

/** Las sesiones con el avance de sus tareas, para que el investigador siga el piloto. */
export class ListarSesiones {
  constructor(private readonly sesiones: RepositorioDeSesiones) {}

  async ejecutar(entrada: z.input<typeof esquemaListar>): Promise<readonly Sesion[]> {
    exigirModerador(validarEntrada(esquemaListar, entrada).rolActor);
    return this.sesiones.listar();
  }
}

const esquemaTarea = z.object({ rolActor: esquemaRol, idTarea: z.uuid() });

/** Lo que el participante ve en la tarea: solo los puntos de su vista, sin decirle cuál es. */
export interface TareaEnCurso {
  readonly tarea: Tarea;
  readonly puntos: readonly (PuntoProcesado | PuntoBase)[];
  readonly caja: {
    latitudMin: number;
    latitudMax: number;
    longitudMin: number;
    longitudMax: number;
  };
}

async function sesionYTarea(
  sesiones: RepositorioDeSesiones,
  idTarea: string,
): Promise<{ sesion: Sesion; tarea: Tarea }> {
  const sesion = await sesiones.buscarPorTarea(idTarea);
  const tarea = sesion?.tareas.find((t) => t.id === idTarea);
  if (!sesion || !tarea) throw new ErrorNoEncontrado('TAREA_NO_ENCONTRADA', 'La tarea no existe');
  return { sesion, tarea };
}

/** Puntos de la vista que corresponde a la tarea, desde su instantánea congelada. */
async function puntosDe(
  instantaneas: RepositorioDeInstantaneas,
  tarea: Tarea,
): Promise<Pick<TareaEnCurso, 'puntos' | 'caja'>> {
  const instantanea = await instantaneas.buscarPorId(tarea.idInstantanea);
  if (!instantanea) {
    throw new ErrorNoEncontrado('INSTANTANEA_NO_ENCONTRADA', 'La instantánea no existe');
  }
  const puntos = tarea.vista === 'PROCESADA' ? instantanea.procesada : instantanea.base;
  return { puntos, caja: instantanea.caja };
}

/**
 * Empieza una tarea: el servidor fija la hora de inicio. La segunda solo empieza cuando la primera
 * terminó, y una tarea no se puede volver a empezar.
 */
export class IniciarTarea {
  constructor(private readonly deps: DependenciasDeTareas) {}

  /** @throws {ErrorConflicto} `TAREA_YA_INICIADA` o `TAREA_ANTERIOR_PENDIENTE`. */
  async ejecutar(entrada: z.input<typeof esquemaTarea>): Promise<TareaEnCurso> {
    const { rolActor, idTarea } = validarEntrada(esquemaTarea, entrada);
    exigirModerador(rolActor);
    const { sesion, tarea } = await sesionYTarea(this.deps.sesiones, idTarea);
    const anterior = sesion.tareas.find((t) => t.orden === tarea.orden - 1);
    if (anterior && anterior.terminadaEn === null) {
      throw new ErrorConflicto('TAREA_ANTERIOR_PENDIENTE', 'Primero hay que terminar la tarea 1');
    }
    const vista = await puntosDe(this.deps.instantaneas, tarea);
    const ahora = this.deps.reloj.ahora();
    if (!(await this.deps.sesiones.iniciar(idTarea, ahora))) {
      throw new ErrorConflicto('TAREA_YA_INICIADA', 'La tarea ya empezó: no se puede repetir');
    }
    return { tarea: { ...tarea, iniciadaEn: ahora }, ...vista };
  }
}

const esquemaTerminar = esquemaTarea.extend({
  marcas: z
    .array(z.object({ idPunto: z.uuid(), msDesdeInicio: z.number().int().min(0) }))
    .max(1000),
});

export type EntradaTerminarTarea = z.input<typeof esquemaTerminar>;

/** Cierra una tarea iniciada con las marcas del participante (`cerrarTarea`). */
export class TerminarTarea {
  constructor(private readonly deps: DependenciasDeTareas) {}

  /** @throws {ErrorConflicto} `TAREA_NO_INICIADA` o `TAREA_YA_TERMINADA`. */
  async ejecutar(entrada: EntradaTerminarTarea): Promise<Tarea> {
    const { rolActor, idTarea, marcas } = validarEntrada(esquemaTerminar, entrada);
    exigirModerador(rolActor);
    const { tarea } = await sesionYTarea(this.deps.sesiones, idTarea);
    if (tarea.iniciadaEn === null) {
      throw new ErrorConflicto('TAREA_NO_INICIADA', 'La tarea aún no empezó');
    }
    const { puntos } = await puntosDe(this.deps.instantaneas, tarea);
    const ids = new Set(puntos.map((p) => ('idEnvio' in p ? p.idEnvio : p.idReporte)));
    const cierre = cerrarTarea(tarea.iniciadaEn, this.deps.reloj.ahora(), marcas, ids);
    if (!(await this.deps.sesiones.cerrar(idTarea, cierre))) {
      throw new ErrorConflicto('TAREA_YA_TERMINADA', 'La tarea ya terminó');
    }
    return { ...tarea, ...cierre };
  }
}
