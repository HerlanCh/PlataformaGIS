import type { IdReporte } from '@gis/shared-kernel';

export type EstadoDeReporte = 'ACTIVO' | 'CONFIRMADO' | 'RESUELTO' | 'CADUCADO' | 'RECHAZADO';

/**
 * Puerto propio hacia `reports`: el estado de un reporte. La raíz de composición lo conecta con
 * la interfaz pública de ese módulo (ADR-001): `moderation` nunca lo importa.
 */
export interface ConsultaDeReporte {
  /** `null` si el reporte no existe. */
  estadoDe(idReporte: IdReporte): Promise<EstadoDeReporte | null>;
}
