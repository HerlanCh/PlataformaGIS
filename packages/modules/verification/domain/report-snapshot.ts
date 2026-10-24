import type { PuntoGeo, IdReporte, IdUsuario } from '@gis/shared-kernel';

/**
 * Lo que `verification` necesita saber de un reporte. Es una copia de lectura:
 * el reporte pertenece al módulo `reports` y solo él lo modifica.
 */
export interface InstantaneaDeReporte {
  readonly id: IdReporte;
  readonly authorId: IdUsuario;
  readonly estado: 'ACTIVO' | 'CONFIRMADO' | 'RESUELTO' | 'CADUCADO' | 'RECHAZADO';
  /** Ubicación real, para medir la distancia del votante. Nunca se expone. */
  readonly location: PuntoGeo;
  /** Extensiones de vigencia ya aplicadas. */
  readonly extensiones: number;
  /**
   * Incidente de fuente oficial (HU-13): lo publicó un moderador citando la fuente, así que su
   * desenlace no cambia la reputación de quien lo publicó.
   */
  readonly esOficial: boolean;
}
