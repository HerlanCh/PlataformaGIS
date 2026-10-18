import { validarEntrada } from '@gis/contracts';
import { idUsuario } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeSuscripcionesPush } from '../domain/ports.js';

const esquemaEntrada = z.object({ idUsuario: z.uuid(), endpoint: z.string().min(1) });

export type EntradaEliminarSuscripcionPush = z.input<typeof esquemaEntrada>;

/**
 * HU-08: deja de enviar avisos a este dispositivo. Solo borra una suscripción propia y es
 * idempotente: eliminar una que no existe no es un error.
 */
export class EliminarSuscripcionPush {
  constructor(private readonly suscripciones: RepositorioDeSuscripcionesPush) {}

  async ejecutar(entrada: EntradaEliminarSuscripcionPush): Promise<void> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    await this.suscripciones.eliminarPorEndpoint(datos.endpoint, idUsuario(datos.idUsuario));
  }
}
