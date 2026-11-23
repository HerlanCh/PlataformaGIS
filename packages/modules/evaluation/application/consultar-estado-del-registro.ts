import { validarEntrada } from '@gis/contracts';
import { z } from 'zod';
import type { RepositorioDeEvaluacion } from '../domain/ports.js';
import type { EstadoDelRegistro } from '../domain/registro.js';
import { esquemaRol, exigirModerador } from './entradas.js';

const esquemaEntrada = z.object({ rolActor: esquemaRol });

export type EntradaConsultarEstadoDelRegistro = z.input<typeof esquemaEntrada>;

/**
 * Cuántos envíos lleva el registro y cuándo llegó el último. La prueba de humo lo usa para saber
 * que el módulo registra (ADR-007, mitigación). Solo para moderadores.
 */
export class ConsultarEstadoDelRegistro {
  constructor(private readonly registro: RepositorioDeEvaluacion) {}

  async ejecutar(entrada: EntradaConsultarEstadoDelRegistro): Promise<EstadoDelRegistro> {
    exigirModerador(validarEntrada(esquemaEntrada, entrada).rolActor);
    return this.registro.estado();
  }
}
