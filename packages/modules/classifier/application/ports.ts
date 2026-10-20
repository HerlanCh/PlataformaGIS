import type { EventoDeIntegracion } from '@gis/contracts';
import type { IdReporte } from '@gis/shared-kernel';
import type { DatosParaClasificar, RegistroDeClasificacion } from '../domain/clasificacion.js';

/**
 * Puerto propio hacia `reports`: la descripción y la actividad reciente del autor. La raíz de
 * composición lo conecta con la interfaz pública de ese módulo (ADR-001).
 */
export interface ConsultaParaClasificar {
  /** `null` si el reporte no existe. */
  datosDe(idReporte: IdReporte): Promise<DatosParaClasificar | null>;
}

/** Guarda la clasificación y su evento en una sola transacción (patrón outbox). */
export interface UnidadDeTrabajoDeClasificacion {
  registrar(
    clasificacion: RegistroDeClasificacion,
    eventos: readonly EventoDeIntegracion[],
  ): Promise<void>;
}
