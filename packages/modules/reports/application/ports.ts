import type { EventoDeIntegracion } from '@gis/contracts';
import type { Reporte } from '../domain/report.js';

/**
 * Unidad de trabajo transaccional: guarda el reporte y sus eventos de integración
 * juntos. Si falla cualquiera de las dos escrituras, no queda ninguna (patrón outbox).
 */
export interface UnidadDeTrabajoDeReporte {
  confirmar(report: Reporte, events: readonly EventoDeIntegracion[]): Promise<void>;
}
