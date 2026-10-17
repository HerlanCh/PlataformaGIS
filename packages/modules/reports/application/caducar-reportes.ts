import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import type { RepositorioDeReportes } from '../domain/ports.js';
import { eventosDeIntegracionDe } from './eventos.js';
import type { UnidadDeTrabajoDeReporte } from './ports.js';

/** Reportes por lote y lotes por ejecución: acotan el trabajo de una pasada de la tarea. */
export const LOTE_DE_CADUCIDAD = { tamano: 200, maxLotes: 50 } as const;

export interface DependenciasCaducarReportes {
  readonly reportes: RepositorioDeReportes;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeReporte;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/**
 * HU-04: pasa a `CADUCADO` los reportes vigentes cuya caducidad ya pasó y emite
 * `ReporteCaducado.v1` por cada uno. Lo ejecuta una tarea periódica.
 */
export class CaducarReportes {
  constructor(private readonly deps: DependenciasCaducarReportes) {}

  async ejecutar(): Promise<{ readonly caducados: number }> {
    const ahora = this.deps.reloj.ahora();
    const { tamano, maxLotes } = LOTE_DE_CADUCIDAD;
    let caducados = 0;

    for (let lote = 0; lote < maxLotes; lote += 1) {
      const vencidos = await this.deps.reportes.buscarCaducados(ahora, tamano);
      for (const reporte of vencidos) {
        reporte.caducar(ahora);
        await this.deps.unidadDeTrabajo.confirmar(
          reporte,
          eventosDeIntegracionDe(reporte, this.deps.ids),
        );
      }
      caducados += vencidos.length;
      // Un lote incompleto significa que ya no quedan vencidos.
      if (vencidos.length < tamano) break;
    }
    return { caducados };
  }
}
