import { validarEntrada } from '@gis/contracts';
import { ErrorProhibido } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeEvaluacion } from '../domain/ports.js';
import type { EstadoDelRegistro } from '../domain/registro.js';

const esquemaEntrada = z.object({ rolActor: z.enum(['CIUDADANO', 'MODERADOR']) });

export type EntradaConsultarEstadoDelRegistro = z.input<typeof esquemaEntrada>;

/**
 * Cuántos envíos lleva el registro y cuándo llegó el último. La prueba de humo lo usa para saber
 * que el módulo registra (ADR-007, mitigación). Solo para moderadores.
 */
export class ConsultarEstadoDelRegistro {
  constructor(private readonly registro: RepositorioDeEvaluacion) {}

  async ejecutar(entrada: EntradaConsultarEstadoDelRegistro): Promise<EstadoDelRegistro> {
    const { rolActor } = validarEntrada(esquemaEntrada, entrada);
    if (rolActor !== 'MODERADOR') {
      throw new ErrorProhibido(
        'ROL_INSUFICIENTE',
        'Solo un moderador puede consultar el registro de la evaluación',
      );
    }
    return this.registro.estado();
  }
}
