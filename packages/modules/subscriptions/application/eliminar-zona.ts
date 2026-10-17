import { validarEntrada } from '@gis/contracts';
import { ErrorNoEncontrado, ErrorProhibido } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeSuscripciones } from '../domain/ports.js';
import { idSuscripcion } from '../domain/zone-subscription.js';

const esquemaEntrada = z.object({ idUsuario: z.uuid(), idZona: z.uuid() });

export type EntradaEliminarZona = z.input<typeof esquemaEntrada>;

/** HU-07, escenario 4: da de baja una zona propia; desde ese momento no genera avisos. */
export class EliminarZona {
  constructor(private readonly suscripciones: RepositorioDeSuscripciones) {}

  async ejecutar(entrada: EntradaEliminarZona): Promise<void> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    const id = idSuscripcion(datos.idZona);
    const zona = await this.suscripciones.buscarPorId(id);
    if (!zona) throw new ErrorNoEncontrado('ZONA_NO_ENCONTRADA', 'La zona suscrita no existe');
    if (zona.idUsuario !== datos.idUsuario) {
      throw new ErrorProhibido('ZONA_AJENA', 'Solo puedes eliminar tus propias zonas');
    }
    await this.suscripciones.eliminar(id);
  }
}
