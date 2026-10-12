import type { IntegrationEvent } from '@gis/contracts';
import type { Report } from '../domain/report.js';

/**
 * Unidad de trabajo transaccional: guarda el reporte y sus eventos de integración
 * juntos. Si falla cualquiera de las dos escrituras, no queda ninguna (patrón outbox).
 */
export interface ReportUnitOfWork {
  commit(report: Report, events: readonly IntegrationEvent[]): Promise<void>;
}
