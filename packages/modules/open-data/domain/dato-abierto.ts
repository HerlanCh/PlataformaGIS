import { AREA_DE_SERVICIO, ErrorDeDominio } from '@gis/shared-kernel';

/** Lado de la celda geográfica de los datos abiertos: la misma rejilla que el mapa de calor. */
export const TAMANO_CELDA_M = 500;

const METROS_POR_GRADO = 111_195;

// Una sola rejilla para toda la ciudad: el ancho en longitud se calcula con la latitud del centro
// del área de servicio, como en `heatmap`, para que las celdas de ambos coincidan.
const LATITUD_DE_REFERENCIA = (AREA_DE_SERVICIO.latitudMin + AREA_DE_SERVICIO.latitudMax) / 2;
const PASO = {
  latitud: TAMANO_CELDA_M / METROS_POR_GRADO,
  longitud: TAMANO_CELDA_M / (METROS_POR_GRADO * Math.cos((LATITUD_DE_REFERENCIA * Math.PI) / 180)),
} as const;

/** Decimales de la celda: con 5 (~1 m) basta para nombrar su centro. */
const redondear = (valor: number): number => Math.round(valor * 1e5) / 1e5;

export interface Celda {
  readonly latitud: number;
  readonly longitud: number;
}

/** Centro de la celda de 500 m que contiene el punto. Nunca devuelve el punto. */
export const celdaDe = (latitud: number, longitud: number): Celda => ({
  latitud: redondear(Math.round(latitud / PASO.latitud) * PASO.latitud),
  longitud: redondear(Math.round(longitud / PASO.longitud) * PASO.longitud),
});

/** Inicio de la hora en que se creó: la hora exacta no se publica. */
export const horaTruncada = (fecha: Date): Date => {
  const hora = new Date(fecha.getTime());
  hora.setUTCMinutes(0, 0, 0);
  return hora;
};

export type EstadoFinal = 'RESUELTO' | 'CADUCADO' | 'RECHAZADO';

const ESTADOS_FINALES: readonly string[] = ['RESUELTO', 'CADUCADO', 'RECHAZADO'];

/** Lo que `open-data` lee de un reporte de `reports`, por su puerto. */
export interface ReporteFinalizado {
  readonly idReporte: string;
  readonly codigoCategoria: string;
  readonly estado: string;
  /** Rechazo de un autor silenciado: ese reporte nunca fue público y no se publica. */
  readonly motivoRechazo: string | null;
  /** Solo la ubicación pública, ya ofuscada en las categorías sensibles. */
  readonly publicLocation: { readonly latitud: number; readonly longitud: number };
  readonly creadoEn: Date;
  readonly extensiones: number;
}

export class ErrorReporteNoPublicable extends ErrorDeDominio {
  constructor(detalle: string) {
    super('REPORTE_NO_PUBLICABLE', `El reporte no va a los datos abiertos: ${detalle}`);
  }
}

/**
 * Fila de los datos abiertos (HU-11): solo categoría, celda, hora truncada, estado final y si la
 * comunidad lo confirmó. No guarda autor, punto, descripción ni el ID del reporte; la `huella`
 * (SHA-256 del ID) solo evita registrarlo dos veces y nunca se publica.
 */
export interface DatoAbierto {
  readonly huella: string;
  readonly codigoCategoria: string;
  readonly celda: Celda;
  readonly hora: Date;
  readonly estadoFinal: EstadoFinal;
  readonly fueConfirmado: boolean;
}

/** `true` si el reporte terminó y alguna vez fue público. */
export const esPublicable = (reporte: ReporteFinalizado): boolean =>
  ESTADOS_FINALES.includes(reporte.estado) && reporte.motivoRechazo !== 'AUTOR_SILENCIADO';

/**
 * Anonimiza un reporte terminado. La huella la calcula quien llama (es un detalle técnico).
 * @throws {ErrorReporteNoPublicable} si sigue vigente o lo rechazó el silenciado de su autor.
 */
export function anonimizar(reporte: ReporteFinalizado, huella: string): DatoAbierto {
  if (!esPublicable(reporte)) {
    throw new ErrorReporteNoPublicable(`sigue ${reporte.estado} o nunca fue público`);
  }
  return {
    huella,
    codigoCategoria: reporte.codigoCategoria,
    celda: celdaDe(reporte.publicLocation.latitud, reporte.publicLocation.longitud),
    hora: horaTruncada(reporte.creadoEn),
    estadoFinal: reporte.estado as EstadoFinal,
    // Toda confirmación extiende la vigencia (SRS 3.2.4).
    fueConfirmado: reporte.extensiones > 0,
  };
}
