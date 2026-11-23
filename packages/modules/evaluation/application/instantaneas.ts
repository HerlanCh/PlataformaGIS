import { validarEntrada } from '@gis/contracts';
import { ErrorNoEncontrado } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type { Instantanea, ResumenDeInstantanea } from '../domain/instantanea.js';
import type { RepositorioDeEvaluacion, RepositorioDeInstantaneas } from '../domain/ports.js';
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
