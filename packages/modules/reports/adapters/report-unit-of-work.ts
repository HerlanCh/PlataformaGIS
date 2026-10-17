import type { EventoDeIntegracion } from '@gis/contracts';
import { agregarASalida, esClaveDuplicada } from '@gis/platform';
import type { Db } from '@gis/platform';
import { ErrorConflicto } from '@gis/shared-kernel';
import { CLAVE_DE_IDEMPOTENCIA_REPETIDA } from '../application/ports.js';
import type { UnidadDeTrabajoDeReporte } from '../application/ports.js';
import type { Reporte } from '../domain/report.js';
import { RepositorioReportesPostgis } from './report-repository.js';

const RESTRICCION_DE_IDEMPOTENCIA = 'reportes_clave_idempotencia_unique';

export class UnidadDeTrabajoReportePg implements UnidadDeTrabajoDeReporte {
  constructor(private readonly db: Db) {}

  async confirmar(reporte: Reporte, eventos: readonly EventoDeIntegracion[]): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await new RepositorioReportesPostgis(tx).guardar(reporte);
        await agregarASalida(tx, eventos);
      });
    } catch (error) {
      if (esClaveDuplicada(error, RESTRICCION_DE_IDEMPOTENCIA)) {
        throw new ErrorConflicto(
          CLAVE_DE_IDEMPOTENCIA_REPETIDA,
          'Ya existe un reporte con esa clave de idempotencia',
        );
      }
      throw error;
    }
  }

  async registrarEventos(eventos: readonly EventoDeIntegracion[]): Promise<void> {
    await agregarASalida(this.db, eventos);
  }
}
