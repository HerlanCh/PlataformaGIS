import type { Ejecutor } from '@gis/platform';
import { idReporte } from '@gis/shared-kernel';
import { sql } from 'drizzle-orm';
import type { HistorialDeDecisiones, UltimaDecision } from '../domain/ports.js';
import { accionesModeracion as tabla } from './schema.js';

export class HistorialDeDecisionesPg implements HistorialDeDecisiones {
  constructor(private readonly db: Ejecutor) {}

  async ultimasDecisiones(): Promise<readonly UltimaDecision[]> {
    // Si un reporte se mantuvo y después se rechazó, cuenta la última decisión.
    const { rows } = await this.db.execute<{ id_reporte: string; accion: string }>(sql`
      select distinct on (${tabla.idReporte}) ${tabla.idReporte} as id_reporte, ${tabla.accion} as accion
      from ${tabla}
      order by ${tabla.idReporte}, ${tabla.creadoEn} desc, ${tabla.id} desc
    `);
    return rows.map((fila) => ({
      idReporte: idReporte(fila.id_reporte),
      accion: fila.accion as UltimaDecision['accion'],
    }));
  }
}
