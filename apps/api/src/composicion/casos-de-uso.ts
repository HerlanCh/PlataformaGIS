// Raíz de composición (roadmap 6.1): el único lugar donde se instancian los adaptadores y se
// inyectan en los casos de uso. Las rutas HTTP solo reciben los casos de uso ya armados.
import { randomUUID } from 'node:crypto';
import { ObtenerMapaDeCalor, ConsultaMapaCalorPg } from '@gis/module-heatmap';
import { RegistrarDispositivo, RepositorioUsuariosPg } from '@gis/module-identity';
import { RechazarReporte, UnidadDeTrabajoModeracionPg } from '@gis/module-moderation';
import {
  CrearReporte,
  ListarReportesEnVentana,
  RepositorioCategoriasPg,
  RepositorioReportesPostgis,
  UnidadDeTrabajoReportePg,
} from '@gis/module-reports';
import { EliminarZona, RepositorioSuscripcionesPg, SuscribirZona } from '@gis/module-subscriptions';
import {
  ConfirmarReporte,
  NegarReporte,
  RepositorioReputacionesPg,
  RepositorioVotosPg,
  UnidadDeTrabajoVotoPg,
} from '@gis/module-verification';
import type { Db, InterruptoresDeFunciones } from '@gis/platform';
import type { GeneradorDeId, LimitadorDeFrecuencia, Reloj } from '@gis/shared-kernel';
import { consultaParaModeracion, consultaParaVerificacion, reputacionDelAutor } from './puentes.js';

type Caso<C extends { ejecutar: (...args: never[]) => unknown }> = Pick<C, 'ejecutar'>;

/** Casos de uso que expone la API. Los de un módulo opcional apagado son `null`. */
export interface CasosDeUso {
  readonly registrarDispositivo: Caso<RegistrarDispositivo>;
  readonly crearReporte: Caso<CrearReporte>;
  readonly listarReportes: Caso<ListarReportesEnVentana>;
  readonly confirmarReporte: Caso<ConfirmarReporte>;
  readonly negarReporte: Caso<NegarReporte>;
  readonly obtenerMapaDeCalor: Caso<ObtenerMapaDeCalor> | null;
  readonly suscribirZona: Caso<SuscribirZona> | null;
  readonly eliminarZona: Caso<EliminarZona> | null;
  readonly rechazarReporte: Caso<RechazarReporte> | null;
}

export const relojDelSistema: Reloj = { ahora: () => new Date() };
export const generadorUuid: GeneradorDeId = { siguiente: () => randomUUID() };

export interface Infraestructura {
  readonly db: Db;
  readonly interruptores: InterruptoresDeFunciones;
  readonly limitador: LimitadorDeFrecuencia;
  readonly reloj?: Reloj;
  readonly ids?: GeneradorDeId;
}

const siActivo = <T>(activo: boolean, crear: () => T): T | null => (activo ? crear() : null);

export function componerCasosDeUso(infraestructura: Infraestructura): CasosDeUso {
  const { db, interruptores, limitador } = infraestructura;
  const reloj = infraestructura.reloj ?? relojDelSistema;
  const ids = infraestructura.ids ?? generadorUuid;

  const reportes = new RepositorioReportesPostgis(db);
  const reputaciones = new RepositorioReputacionesPg(db);
  const voto = {
    consultaDeReporte: consultaParaVerificacion(reportes),
    votos: new RepositorioVotosPg(db),
    reputaciones,
    unidadDeTrabajo: new UnidadDeTrabajoVotoPg(db),
    limitador,
    reloj,
    ids,
  };
  const suscripciones = new RepositorioSuscripcionesPg(db);

  return {
    registrarDispositivo: new RegistrarDispositivo({
      usuarios: new RepositorioUsuariosPg(db),
      reloj,
      ids,
    }),
    crearReporte: new CrearReporte({
      reportes,
      categorias: new RepositorioCategoriasPg(db),
      unidadDeTrabajo: new UnidadDeTrabajoReportePg(db),
      reputacion: reputacionDelAutor(reputaciones),
      limitador,
      reloj,
      ids,
    }),
    listarReportes: new ListarReportesEnVentana(reportes, reloj),
    confirmarReporte: new ConfirmarReporte(voto),
    negarReporte: new NegarReporte(voto),
    obtenerMapaDeCalor: siActivo(
      interruptores.estaActivo('heatmap'),
      () => new ObtenerMapaDeCalor(new ConsultaMapaCalorPg(db)),
    ),
    suscribirZona: siActivo(
      interruptores.estaActivo('subscriptions'),
      () => new SuscribirZona({ suscripciones, reloj, ids }),
    ),
    eliminarZona: siActivo(
      interruptores.estaActivo('subscriptions'),
      () => new EliminarZona(suscripciones),
    ),
    rechazarReporte: siActivo(
      interruptores.estaActivo('moderation'),
      () =>
        new RechazarReporte({
          consultaDeReporte: consultaParaModeracion(reportes),
          unidadDeTrabajo: new UnidadDeTrabajoModeracionPg(db),
          reloj,
          ids,
        }),
    ),
  };
}
