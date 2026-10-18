// «¿Sigue ahí?» automático (HU-03): a quién preguntarle por qué reporte.
import { distanciaM } from './geo.js';
import type { Punto } from './geo.js';
import type { ReportePublico } from './reportes.js';

/** Solo se pregunta por un incidente a esta distancia o menos (SRS 3.2). */
export const RADIO_DE_PREGUNTA_M = 150;

/**
 * El reporte más cercano a menos de 150 m por el que se puede preguntar. `excluidos` son los que
 * no van: propios, ya votados o ya preguntados.
 */
export function reporteParaPreguntar(
  reportes: readonly ReportePublico[],
  posicion: Punto,
  excluidos: ReadonlySet<string>,
): ReportePublico | null {
  let elegido: ReportePublico | null = null;
  let menor = RADIO_DE_PREGUNTA_M;
  for (const reporte of reportes) {
    if (excluidos.has(reporte.id)) continue;
    const metros = distanciaM(posicion, reporte.publicLocation);
    if (metros <= menor) {
      elegido = reporte;
      menor = metros;
    }
  }
  return elegido;
}
