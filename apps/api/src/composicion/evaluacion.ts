// Instrumentos de evaluación (Fase 13, ADR-007): casos de uso del módulo `evaluation` con sus
// adaptadores. Solo se componen con `FEATURE_EVALUATION` activo.
import { randomInt } from 'node:crypto';
import {
  CongelarInstantanea,
  ConsultarEstadoDelRegistro,
  ConsultarVistas,
  CrearSesion,
  GuardarEtiquetas,
  IniciarTarea,
  ListarEnviosParaEtiquetar,
  ListarInstantaneas,
  ListarSesiones,
  ListarVerificaciones,
  MedirAcuerdo,
  ObtenerInstantanea,
  RegistrarVerificacion,
  RepositorioEtiquetasPg,
  RepositorioEvaluacionPg,
  RepositorioInstantaneasPg,
  RepositorioSesionesPg,
  RepositorioVerificacionesPg,
  SortearReportes,
  TerminarTarea,
} from '@gis/module-evaluation';
import { CATEGORIAS_MVP } from '@gis/module-reports';
import type { Db } from '@gis/platform';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';

type Caso<C extends { ejecutar: (...args: never[]) => unknown }> = Pick<C, 'ejecutar'>;

export interface Evaluacion {
  readonly estado: Caso<ConsultarEstadoDelRegistro>;
  readonly vistas: Caso<ConsultarVistas>;
  readonly congelar: Caso<CongelarInstantanea>;
  readonly listarInstantaneas: Caso<ListarInstantaneas>;
  readonly obtenerInstantanea: Caso<ObtenerInstantanea>;
  readonly crearSesion: Caso<CrearSesion>;
  readonly listarSesiones: Caso<ListarSesiones>;
  readonly iniciarTarea: Caso<IniciarTarea>;
  readonly terminarTarea: Caso<TerminarTarea>;
  readonly enviosParaEtiquetar: Caso<ListarEnviosParaEtiquetar>;
  readonly guardarEtiquetas: Caso<GuardarEtiquetas>;
  readonly medirAcuerdo: Caso<MedirAcuerdo>;
  readonly sortear: Caso<SortearReportes>;
  readonly registrarVerificacion: Caso<RegistrarVerificacion>;
  readonly listarVerificaciones: Caso<ListarVerificaciones>;
}

/** Radio de deduplicación de cada categoría (SRS 3.1), para los pares candidatos del kappa. */
export const radiosDeDeduplicacion = (): ReadonlyMap<string, number> =>
  new Map(CATEGORIAS_MVP.map((c) => [c.codigo, c.radioDuplicadoM]));

/** Azar del sorteo: un entero criptográfico llevado a `[0, 1)`. */
const azar = (): number => randomInt(0, 2 ** 47) / 2 ** 47;

export function componerEvaluacion(db: Db, reloj: Reloj, ids: GeneradorDeId): Evaluacion {
  const registro = new RepositorioEvaluacionPg(db);
  const instantaneas = new RepositorioInstantaneasPg(db);
  const sesiones = new RepositorioSesionesPg(db);
  const etiquetas = new RepositorioEtiquetasPg(db);
  const verificaciones = new RepositorioVerificacionesPg(db);
  const tareas = { sesiones, instantaneas, reloj, ids };
  return {
    estado: new ConsultarEstadoDelRegistro(registro),
    vistas: new ConsultarVistas(registro, reloj),
    congelar: new CongelarInstantanea({ registro, instantaneas, reloj, ids }),
    listarInstantaneas: new ListarInstantaneas(instantaneas),
    obtenerInstantanea: new ObtenerInstantanea(instantaneas),
    crearSesion: new CrearSesion(tareas),
    listarSesiones: new ListarSesiones(sesiones),
    iniciarTarea: new IniciarTarea(tareas),
    terminarTarea: new TerminarTarea(tareas),
    enviosParaEtiquetar: new ListarEnviosParaEtiquetar(registro, etiquetas),
    guardarEtiquetas: new GuardarEtiquetas(etiquetas),
    medirAcuerdo: new MedirAcuerdo(registro, etiquetas, radiosDeDeduplicacion()),
    sortear: new SortearReportes(registro, azar),
    registrarVerificacion: new RegistrarVerificacion(verificaciones, reloj),
    listarVerificaciones: new ListarVerificaciones(verificaciones),
  };
}
