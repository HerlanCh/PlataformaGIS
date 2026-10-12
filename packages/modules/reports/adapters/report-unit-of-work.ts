import type { EventoDeIntegracion } from '@gis/contracts';
import { agregarASalida } from '@gis/platform';
import type { Db } from '@gis/platform';
import type { UnidadDeTrabajoDeReporte } from '../application/ports.js';
import type { Reporte } from '../domain/report.js';
import { RepositorioReportesPostgis } from './report-repository.js';

export class UnidadDeTrabajoReportePg implements UnidadDeTrabajoDeReporte {
  constructor(private readonly db: Db) {}

  async confirmar(reporte: Reporte, eventos: readonly EventoDeIntegracion[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await new RepositorioReportesPostgis(tx).guardar(reporte);
      await agregarASalida(tx, eventos);
    });
  }
}
