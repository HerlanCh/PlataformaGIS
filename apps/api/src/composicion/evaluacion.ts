// Instrumentos de evaluación (Fase 13, ADR-007): casos de uso del módulo `evaluation` con sus
// adaptadores. Solo se componen con `FEATURE_EVALUATION` activo.
import {
  CongelarInstantanea,
  ConsultarEstadoDelRegistro,
  ConsultarVistas,
  ListarInstantaneas,
  ObtenerInstantanea,
  RepositorioEvaluacionPg,
  RepositorioInstantaneasPg,
} from '@gis/module-evaluation';
import type { Db } from '@gis/platform';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';

type Caso<C extends { ejecutar: (...args: never[]) => unknown }> = Pick<C, 'ejecutar'>;

export interface Evaluacion {
  readonly estado: Caso<ConsultarEstadoDelRegistro>;
  readonly vistas: Caso<ConsultarVistas>;
  readonly congelar: Caso<CongelarInstantanea>;
  readonly listarInstantaneas: Caso<ListarInstantaneas>;
  readonly obtenerInstantanea: Caso<ObtenerInstantanea>;
}

export function componerEvaluacion(db: Db, reloj: Reloj, ids: GeneradorDeId): Evaluacion {
  const registro = new RepositorioEvaluacionPg(db);
  const instantaneas = new RepositorioInstantaneasPg(db);
  return {
    estado: new ConsultarEstadoDelRegistro(registro),
    vistas: new ConsultarVistas(registro, reloj),
    congelar: new CongelarInstantanea({ registro, instantaneas, reloj, ids }),
    listarInstantaneas: new ListarInstantaneas(instantaneas),
    obtenerInstantanea: new ObtenerInstantanea(instantaneas),
  };
}
