import { validarEntrada } from '@gis/contracts';
import type { Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeEvaluacion } from '../domain/ports.js';
import { reconstruirVistas } from '../domain/vistas.js';
import type { Vistas } from '../domain/vistas.js';
import {
  esquemaCaja,
  esquemaInstante,
  esquemaRol,
  exigirModerador,
  exigirPasado,
} from './entradas.js';

const esquemaEntrada = z.object({
  rolActor: esquemaRol,
  instante: esquemaInstante,
  caja: esquemaCaja,
});

export type EntradaConsultarVistas = z.input<typeof esquemaEntrada>;

/**
 * ADR-007: la vista procesada y la vista base de una zona en un instante, reconstruidas desde el
 * registro. Sirve para elegir qué congelar; las tareas usan instantáneas, nunca esta consulta.
 */
export class ConsultarVistas {
  constructor(
    private readonly registro: RepositorioDeEvaluacion,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: EntradaConsultarVistas): Promise<Vistas> {
    const { rolActor, instante, caja } = validarEntrada(esquemaEntrada, entrada);
    exigirModerador(rolActor);
    exigirPasado(instante, this.reloj.ahora());
    return reconstruirVistas(await this.registro.buscarParaVistas(instante, caja), instante, caja);
  }
}
