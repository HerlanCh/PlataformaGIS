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

export interface ResultadoDeCaducidad {
  readonly caducados: number;
  /** Caducidad más próxima de los vigentes: cuándo conviene la siguiente ejecución. */
  readonly proximaCaducidad: Date | null;
}

/**
 * HU-04: pasa a `CADUCADO` los reportes vigentes cuya caducidad ya pasó y emite
 * `ReporteCaducado.v1` por cada uno. La ejecuta una tarea programada para la caducidad más
 * próxima, sin consultar la base a intervalos cortos (RSK-02).
 */
export class CaducarReportes {
  constructor(private readonly deps: DependenciasCaducarReportes) {}

  async ejecutar(): Promise<ResultadoDeCaducidad> {
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
    return { caducados, proximaCaducidad: await this.deps.reportes.proximaCaducidad() };
  }
}
