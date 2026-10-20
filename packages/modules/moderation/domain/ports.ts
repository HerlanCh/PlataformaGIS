import type { IdReporte } from '@gis/shared-kernel';
import type { CasoDeModeracion } from './caso-de-moderacion.js';

export type EstadoDeReporte = 'ACTIVO' | 'CONFIRMADO' | 'RESUELTO' | 'CADUCADO' | 'RECHAZADO';

/** Lo que un moderador necesita ver de un reporte para decidir. */
export interface DetalleDeReporte {
  readonly idReporte: IdReporte;
  readonly codigoCategoria: string;
  readonly estado: EstadoDeReporte;
  /** Descripción privada del autor: solo la ven los moderadores. */
  readonly descripcion: string | null;
  /** Nunca la ubicación real. */
  readonly publicLocation: { readonly latitud: number; readonly longitud: number };
  readonly creadoEn: Date;
}

/**
 * Puerto propio hacia `reports`. La raíz de composición lo conecta con la interfaz pública de ese
 * módulo (ADR-001): `moderation` nunca lo importa.
 */
export interface ConsultaDeReporte {
  /** `null` si el reporte no existe. */
  estadoDe(idReporte: IdReporte): Promise<EstadoDeReporte | null>;
  /** Detalle de los reportes que existen, en cualquier orden. */
  detallesDe(ids: readonly IdReporte[]): Promise<readonly DetalleDeReporte[]>;
}

/** La cola de moderación, que es de este módulo. */
export interface RepositorioDeCola {
  buscar(idReporte: IdReporte): Promise<CasoDeModeracion | null>;
  guardar(caso: CasoDeModeracion): Promise<void>;
  /** Casos pendientes, en orden de revisión (`compararPrioridad`), hasta `limite`. */
  listarPendientes(limite: number): Promise<readonly CasoDeModeracion[]>;
}
