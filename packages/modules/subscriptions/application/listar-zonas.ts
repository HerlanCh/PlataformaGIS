import { validarEntrada } from '@gis/contracts';
import { idUsuario } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeSuscripciones } from '../domain/ports.js';
import type { ZonaSuscrita } from '../domain/zone-subscription.js';

const esquemaEntrada = z.object({ idUsuario: z.uuid() });

export type EntradaListarZonas = z.input<typeof esquemaEntrada>;

/** HU-07: las zonas suscritas del usuario, de la más reciente a la más antigua. */
export class ListarZonas {
  constructor(private readonly suscripciones: RepositorioDeSuscripciones) {}

  async ejecutar(entrada: EntradaListarZonas): Promise<readonly ZonaSuscrita[]> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    const zonas = await this.suscripciones.buscarPorUsuario(idUsuario(datos.idUsuario));
    return [...zonas].sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
  }
}
