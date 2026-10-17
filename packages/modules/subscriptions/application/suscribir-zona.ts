import { esquemaCodigoCategoria, validarEntrada } from '@gis/contracts';
import {
  aErrorDeAplicacion,
  codigoCategoria,
  ErrorConflicto,
  idUsuario,
  PuntoGeo,
} from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeSuscripciones } from '../domain/ports.js';
import { idSuscripcion, ZonaSuscrita } from '../domain/zone-subscription.js';

/** Zonas suscritas por usuario (SRS 3.3). */
export const MAX_ZONAS_POR_USUARIO = 5;

const esquemaEntrada = z.object({
  idUsuario: z.uuid(),
  latitud: z.number(),
  longitud: z.number(),
  radioM: z.number(),
  categorias: z.array(esquemaCodigoCategoria),
});

export type EntradaSuscribirZona = z.input<typeof esquemaEntrada>;

export interface DependenciasSuscribirZona {
  readonly suscripciones: RepositorioDeSuscripciones;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/** HU-07: crea una zona de interés con su radio y sus categorías. */
export class SuscribirZona {
  constructor(private readonly deps: DependenciasSuscribirZona) {}

  async ejecutar(entrada: EntradaSuscribirZona): Promise<ZonaSuscrita> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    const usuario = idUsuario(datos.idUsuario);

    const actuales = await this.deps.suscripciones.buscarPorUsuario(usuario);
    if (actuales.length >= MAX_ZONAS_POR_USUARIO) {
      throw new ErrorConflicto(
        'LIMITE_DE_ZONAS',
        `Se permiten como máximo ${MAX_ZONAS_POR_USUARIO} zonas suscritas por usuario`,
      );
    }

    let zona: ZonaSuscrita;
    try {
      zona = ZonaSuscrita.crear({
        id: idSuscripcion(this.deps.ids.siguiente()),
        idUsuario: usuario,
        centro: PuntoGeo.crear(datos.latitud, datos.longitud),
        radioM: datos.radioM,
        categorias: datos.categorias.map(codigoCategoria),
        ahora: this.deps.reloj.ahora(),
      });
    } catch (error) {
      throw aErrorDeAplicacion(error, {
        RADIO_INVALIDO: 'VALIDACION_FALLIDA',
        SIN_CATEGORIAS: 'VALIDACION_FALLIDA',
        FUERA_DEL_AREA_DE_SERVICIO: 'VALIDACION_FALLIDA',
      });
    }
    await this.deps.suscripciones.guardar(zona);
    return zona;
  }
}
