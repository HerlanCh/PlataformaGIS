import { esquemaCodigoCategoria, validarEntrada } from '@gis/contracts';
import { aErrorDeAplicacion, codigoCategoria, ErrorValidacionFallida } from '@gis/shared-kernel';
import { z } from 'zod';
import { validarConsultaDeCalor } from '../domain/consulta-de-calor.js';
import type {
  CeldaDeCalor,
  ConsultaDeCalor,
  ConsultaDeMapaDeCalor,
} from '../domain/consulta-de-calor.js';

/** Tamaño de celda por defecto (SRS 3.3). */
export const TAMANO_CELDA_POR_DEFECTO_M = 250;

/**
 * Rango máximo de fechas por consulta. Un rango que abarca casi toda la historia obliga a
 * recorrer la tabla entera (medición de la Fase 4).
 */
export const MAX_DIAS_POR_CONSULTA = 90;

const MS_POR_DIA = 86_400_000;
const latitud = z.number().min(-90).max(90);
const longitud = z.number().min(-180).max(180);

const esquemaEntrada = z.object({
  latitudMin: latitud,
  latitudMax: latitud,
  longitudMin: longitud,
  longitudMax: longitud,
  desde: z.coerce.date(),
  hasta: z.coerce.date(),
  tamanoCeldaM: z.number().default(TAMANO_CELDA_POR_DEFECTO_M),
  categorias: z.array(esquemaCodigoCategoria).default([]),
});

export type EntradaObtenerMapaDeCalor = z.input<typeof esquemaEntrada>;

/** HU-06: celdas con su conteo de reportes en un rango de fechas, nunca puntos sueltos. */
export class ObtenerMapaDeCalor {
  constructor(private readonly consulta: ConsultaDeMapaDeCalor) {}

  async ejecutar(entrada: EntradaObtenerMapaDeCalor): Promise<readonly CeldaDeCalor[]> {
    const { desde, hasta, tamanoCeldaM, categorias, ...caja } = validarEntrada(
      esquemaEntrada,
      entrada,
    );
    const consulta: ConsultaDeCalor = {
      caja,
      tamanoCeldaM,
      desde,
      hasta,
      categorias: categorias.map(codigoCategoria),
    };
    try {
      validarConsultaDeCalor(consulta);
    } catch (error) {
      throw aErrorDeAplicacion(error, { CONSULTA_DE_CALOR_INVALIDA: 'VALIDACION_FALLIDA' });
    }
    if (hasta.getTime() - desde.getTime() > MAX_DIAS_POR_CONSULTA * MS_POR_DIA) {
      throw new ErrorValidacionFallida(
        'RANGO_DEMASIADO_AMPLIO',
        `El rango de fechas no puede pasar de ${MAX_DIAS_POR_CONSULTA} días`,
      );
    }
    return this.consulta.agregar(consulta);
  }
}
