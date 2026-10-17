import type { EventoDeIntegracion } from '@gis/contracts';
import type { Reporte } from '../domain/report.js';

/** Código del `ErrorConflicto` que lanza la unidad de trabajo si la clave de idempotencia ya existe. */
export const CLAVE_DE_IDEMPOTENCIA_REPETIDA = 'CLAVE_DE_IDEMPOTENCIA_REPETIDA';

/**
 * Unidad de trabajo transaccional: guarda el reporte y sus eventos de integración
 * juntos. Si falla cualquiera de las dos escrituras, no queda ninguna (patrón outbox).
 */
export interface UnidadDeTrabajoDeReporte {
  /**
   * @throws {ErrorConflicto} con código `CLAVE_DE_IDEMPOTENCIA_REPETIDA` si otro reporte ya
   * usa su clave de idempotencia (dos envíos simultáneos del mismo reporte).
   */
  confirmar(report: Reporte, events: readonly EventoDeIntegracion[]): Promise<void>;
  /** Guarda solo eventos, cuando el caso de uso no cambia ningún reporte (un duplicado). */
  registrarEventos(events: readonly EventoDeIntegracion[]): Promise<void>;
}
