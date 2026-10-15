import { AREA_DE_SERVICIO, ErrorDeDominio } from '@gis/shared-kernel';
import type { CajaGeografica, CodigoCategoria } from '@gis/shared-kernel';

/**
 * Una celda con menos reportes que este umbral no se publica: con uno o dos reportes el mapa
 * señalaría un incidente y a quien lo reportó (anonimato y antiestigmatización).
 */
export const UMBRAL_ANONIMATO = 3;

/** Tamaño permitido de la celda, en metros. Una celda menor señalaría una vivienda concreta. */
export const TAMANO_CELDA_M = { min: 100, max: 5000 } as const;

const METROS_POR_GRADO = 111_195;

// La cuadrícula es una sola para toda la ciudad: el ancho de la celda en grados de longitud se
// calcula con la latitud del centro del área de servicio, no con la de cada ventana.
const LATITUD_DE_REFERENCIA = (AREA_DE_SERVICIO.latitudMin + AREA_DE_SERVICIO.latitudMax) / 2;
const COSENO_DE_REFERENCIA = Math.cos((LATITUD_DE_REFERENCIA * Math.PI) / 180);

export interface ConsultaDeCalor {
  readonly caja: CajaGeografica;
  readonly tamanoCeldaM: number;
  readonly desde: Date;
  readonly hasta: Date;
  /** Lista vacía: todas las categorías. */
  readonly categorias: readonly CodigoCategoria[];
}

/** Celda con al menos `UMBRAL_ANONIMATO` reportes. Las coordenadas son el centro de la celda. */
export interface CeldaDeCalor {
  readonly latitud: number;
  readonly longitud: number;
  readonly cantidad: number;
}

/** Puerto de lectura del mapa de calor. Solo agrega: nunca devuelve reportes individuales. */
export interface ConsultaDeMapaDeCalor {
  agregar(consulta: ConsultaDeCalor): Promise<readonly CeldaDeCalor[]>;
}

/** Lado de la celda en grados. Depende solo del tamaño pedido, nunca de la ventana. */
export interface PasoDeCuadricula {
  readonly latitud: number;
  readonly longitud: number;
}

export interface Cuadricula {
  readonly paso: PasoDeCuadricula;
  /** Centros de celda extremos entre los que caen las celdas que tocan la ventana. */
  readonly centros: CajaGeografica;
  /** Área que ocupan esas celdas enteras: siempre contiene a la ventana. */
  readonly envolvente: CajaGeografica;
}

export class ErrorConsultaDeCalorInvalida extends ErrorDeDominio {
  constructor(detalle: string) {
    super('CONSULTA_DE_CALOR_INVALIDA', `Consulta de mapa de calor inválida: ${detalle}`);
  }
}

/** @throws {ErrorConsultaDeCalorInvalida} si el tamaño de celda, el rango o la caja no son válidos. */
export function validarConsultaDeCalor(consulta: ConsultaDeCalor): void {
  const { caja, tamanoCeldaM, desde, hasta } = consulta;
  if (
    !Number.isInteger(tamanoCeldaM) ||
    tamanoCeldaM < TAMANO_CELDA_M.min ||
    tamanoCeldaM > TAMANO_CELDA_M.max
  ) {
    throw new ErrorConsultaDeCalorInvalida(
      `la celda debe medir entre ${TAMANO_CELDA_M.min} m y ${TAMANO_CELDA_M.max} m, en metros enteros`,
    );
  }
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || desde > hasta) {
    throw new ErrorConsultaDeCalorInvalida('el rango de fechas es inválido o está invertido');
  }
  if (caja.latitudMin > caja.latitudMax || caja.longitudMin > caja.longitudMax) {
    throw new ErrorConsultaDeCalorInvalida('la caja está invertida');
  }
}

export const pasoDeCuadricula = (tamanoCeldaM: number): PasoDeCuadricula => ({
  latitud: tamanoCeldaM / METROS_POR_GRADO,
  longitud: tamanoCeldaM / (METROS_POR_GRADO * COSENO_DE_REFERENCIA),
});

/**
 * Cuadrícula fija para una ventana. Las celdas están centradas en los múltiplos del paso, así
 * que no se mueven al desplazar el mapa, y la ventana se amplía hasta cubrir celdas enteras:
 * una celda cortada por el borde se cuenta completa. Sin esto, mover la ventana unos metros
 * cambiaría los conteos y permitiría aislar un reporte pese al umbral de anonimato.
 */
export function cuadriculaPara(caja: CajaGeografica, tamanoCeldaM: number): Cuadricula {
  const paso = pasoDeCuadricula(tamanoCeldaM);
  const centro = (valor: number, lado: number) => Math.round(valor / lado) * lado;
  const centros: CajaGeografica = {
    latitudMin: centro(caja.latitudMin, paso.latitud),
    latitudMax: centro(caja.latitudMax, paso.latitud),
    longitudMin: centro(caja.longitudMin, paso.longitud),
    longitudMax: centro(caja.longitudMax, paso.longitud),
  };
  return {
    paso,
    centros,
    envolvente: {
      latitudMin: centros.latitudMin - paso.latitud / 2,
      latitudMax: centros.latitudMax + paso.latitud / 2,
      longitudMin: centros.longitudMin - paso.longitud / 2,
      longitudMax: centros.longitudMax + paso.longitud / 2,
    },
  };
}
