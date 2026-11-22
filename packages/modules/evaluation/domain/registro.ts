/**
 * Registro propio del módulo `evaluation` (ADR-007): lo que hace falta para reconstruir la vista
 * procesada y la vista base en cualquier instante, sin datos personales. No hay campo para el
 * autor, el votante ni la ubicación real: el registro no los puede guardar.
 */

/** Un envío que llegó a ser reporte, o uno que `reports` absorbió como duplicado. */
export type TipoDeEnvio = 'CREADO' | 'DUPLICADO';

export type EstadoRegistrado = 'ACTIVO' | 'CONFIRMADO' | 'RESUELTO' | 'CADUCADO' | 'RECHAZADO';

export type ValorDeVoto = 'CONFIRMACION' | 'NEGACION';

export type DecisionDeVoto = 'NINGUNA' | 'CONFIRMAR' | 'EXTENDER' | 'RESOLVER';

export interface UbicacionPublica {
  readonly latitud: number;
  readonly longitud: number;
}

export interface Envio {
  /** En un envío `CREADO` es el ID del reporte; en uno `DUPLICADO`, uno propio. */
  readonly idEnvio: string;
  readonly tipo: TipoDeEnvio;
  /** El reporte creado o, si es un duplicado, el reporte que lo absorbió. */
  readonly idReporte: string;
  readonly codigoCategoria: string;
  readonly publicLocation: UbicacionPublica;
  /** Fuente citada por el moderador (HU-13); `null` en los envíos de la comunidad. */
  readonly fuenteOficial: string | null;
  readonly recibidoEn: Date;
}

/**
 * Un cambio de estado de un reporte, con la caducidad que deja. La creación es la primera
 * transición; una extensión deja el reporte `CONFIRMADO` con otra caducidad, y un cierre no
 * tiene caducidad.
 */
export interface Transicion {
  readonly idEvento: string;
  readonly idReporte: string;
  readonly estado: EstadoRegistrado;
  readonly caducaEn: Date | null;
  readonly ocurridoEn: Date;
}

/** Un voto con su peso y la decisión que produjo, sin quién votó. */
export interface VotoRegistrado {
  readonly idEvento: string;
  readonly idReporte: string;
  readonly valor: ValorDeVoto;
  readonly peso: number;
  readonly decision: DecisionDeVoto;
  readonly ocurridoEn: Date;
}

/** Lo que la prueba de humo necesita para saber que el registro está vivo. */
export interface EstadoDelRegistro {
  readonly enviosRegistrados: number;
  readonly ultimoEnvioEn: Date | null;
}
