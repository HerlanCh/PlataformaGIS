import type { GeoPoint, ReportId, UserId } from '@gis/shared-kernel';

/**
 * Lo que `verification` necesita saber de un reporte. Es una copia de lectura:
 * el reporte pertenece al módulo `reports` y solo él lo modifica.
 */
export interface ReportSnapshot {
  readonly id: ReportId;
  readonly authorId: UserId;
  readonly status: 'ACTIVO' | 'CONFIRMADO' | 'RESUELTO' | 'CADUCADO' | 'RECHAZADO';
  /** Ubicación real, para medir la distancia del votante. Nunca se expone. */
  readonly location: GeoPoint;
  /** Extensiones de vigencia ya aplicadas. */
  readonly extensions: number;
}
