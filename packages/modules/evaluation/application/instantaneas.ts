import { validarEntrada } from '@gis/contracts';
import { ErrorConflicto, ErrorNoEncontrado } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import { MAX_GRUPOS_EN_CLAVE } from '../domain/instantanea.js';
import type { Instantanea, ResumenDeInstantanea } from '../domain/instantanea.js';
import { MAX_NOMBRE_DE_GRUPO } from '../domain/etiquetado.js';
import type {
  RepositorioDeEvaluacion,
  RepositorioDeInstantaneas,
  RepositorioDeSesiones,
} from '../domain/ports.js';
import { reconstruirVistas } from '../domain/vistas.js';
import {
  esquemaCaja,
  esquemaInstante,
  esquemaNombre,
  esquemaRol,
  exigirModerador,
  exigirPasado,
} from './entradas.js';

export interface DependenciasDeInstantaneas {
  readonly registro: RepositorioDeEvaluacion;
  readonly instantaneas: RepositorioDeInstantaneas;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

const esquemaCongelar = z.object({
  rolActor: esquemaRol,
  nombre: esquemaNombre,
  instante: esquemaInstante,
  caja: esquemaCaja,
});

export type EntradaCongelarInstantanea = z.input<typeof esquemaCongelar>;

/**
 * ADR-007: un moderador fija un instante y una zona, y el módulo guarda el contenido de ambas
 * vistas como una instantánea inmutable (escenarios E1 y E2 del piloto).
 */
export class CongelarInstantanea {
  constructor(private readonly deps: DependenciasDeInstantaneas) {}

  async ejecutar(entrada: EntradaCongelarInstantanea): Promise<Instantanea> {
    const { rolActor, nombre, instante, caja } = validarEntrada(esquemaCongelar, entrada);
    exigirModerador(rolActor);
    const ahora = this.deps.reloj.ahora();
    exigirPasado(instante, ahora);
    const vistas = reconstruirVistas(
      await this.deps.registro.buscarParaVistas(instante, caja),
      instante,
      caja,
    );
    const instantanea: Instantanea = {
      ...vistas,
      id: this.deps.ids.siguiente(),
      nombre,
      creadaEn: ahora,
      clave: [],
    };
    await this.deps.instantaneas.guardar(instantanea);
    return instantanea;
  }
}

const esquemaListar = z.object({ rolActor: esquemaRol });
const esquemaObtener = z.object({ rolActor: esquemaRol, id: z.uuid() });

export type EntradaListarInstantaneas = z.input<typeof esquemaListar>;
export type EntradaObtenerInstantanea = z.input<typeof esquemaObtener>;

/** Las instantáneas congeladas, de la más reciente a la más antigua, sin sus puntos. */
export class ListarInstantaneas {
  constructor(private readonly instantaneas: RepositorioDeInstantaneas) {}

  async ejecutar(entrada: EntradaListarInstantaneas): Promise<readonly ResumenDeInstantanea[]> {
    exigirModerador(validarEntrada(esquemaListar, entrada).rolActor);
    return this.instantaneas.listar();
  }
}

/** Una instantánea con los puntos de ambas vistas, tal como se congeló. */
export class ObtenerInstantanea {
  constructor(private readonly instantaneas: RepositorioDeInstantaneas) {}

  /** @throws {ErrorNoEncontrado} con código `INSTANTANEA_NO_ENCONTRADA`. */
  async ejecutar(entrada: EntradaObtenerInstantanea): Promise<Instantanea> {
    const { rolActor, id } = validarEntrada(esquemaObtener, entrada);
    exigirModerador(rolActor);
    const instantanea = await this.instantaneas.buscarPorId(id);
    if (!instantanea) {
      throw new ErrorNoEncontrado('INSTANTANEA_NO_ENCONTRADA', 'La instantánea no existe');
    }
    return instantanea;
  }
}

const esquemaClave = z.object({
  rolActor: esquemaRol,
  id: z.uuid(),
  grupos: z
    .array(z.string().trim().min(1).max(MAX_NOMBRE_DE_GRUPO))
    .max(MAX_GRUPOS_EN_CLAVE)
    .transform((grupos) => [...new Set(grupos)]),
});

export type EntradaFijarClave = z.input<typeof esquemaClave>;

export interface DependenciasDeClave {
  readonly instantaneas: RepositorioDeInstantaneas;
  readonly sesiones: Pick<RepositorioDeSesiones, 'hayTareasIniciadas'>;
}

/**
 * Perfil v5, 6.3: los dos evaluadores fijan los incidentes activos de la instantánea (la respuesta
 * correcta de la tarea) antes de las sesiones. Se puede corregir hasta que empieza la primera tarea
 * sobre ella; después, no.
 */
export class FijarClave {
  constructor(private readonly deps: DependenciasDeClave) {}

  /**
   * @throws {ErrorNoEncontrado} `INSTANTANEA_NO_ENCONTRADA`.
   * @throws {ErrorConflicto} `CLAVE_EN_USO` si ya empezó una tarea sobre la instantánea.
   */
  async ejecutar(entrada: EntradaFijarClave): Promise<Instantanea> {
    const { rolActor, id, grupos } = validarEntrada(esquemaClave, entrada);
    exigirModerador(rolActor);
    const instantanea = await this.deps.instantaneas.buscarPorId(id);
    if (!instantanea) {
      throw new ErrorNoEncontrado('INSTANTANEA_NO_ENCONTRADA', 'La instantánea no existe');
    }
    if (await this.deps.sesiones.hayTareasIniciadas(id)) {
      throw new ErrorConflicto(
        'CLAVE_EN_USO',
        'Ya empezó una tarea sobre esta instantánea: su clave no cambia',
      );
    }
    await this.deps.instantaneas.fijarClave(id, grupos);
    return { ...instantanea, clave: grupos };
  }
}
