// Raíz de composición de las reacciones entre módulos (Fase 7): cada manejador de evento se
// construye con sus adaptadores y se suscribe al bus con un nombre estable, que la bandeja de
// entrada (`eventos_procesados`) usa para no repetir un evento ya procesado.
import type { BusDeEventos } from '@gis/event-bus';
import {
  AplicarDecisionDeVerificacion,
  AplicarRechazoDeModeracion,
  RepositorioReportesPostgis,
  UnidadDeTrabajoReportePg,
} from '@gis/module-reports';
import { NotificarSuscriptores, RepositorioSuscripcionesPg } from '@gis/module-subscriptions';
import type { AvisoDeReporte, EnviadorDeNotificaciones } from '@gis/module-subscriptions';
import {
  AjustarReputacionPorDesenlace,
  RegistrarConfirmacionPorDuplicado,
  RepositorioReputacionesPg,
  RepositorioVotosPg,
  UnidadDeTrabajoVotoPg,
} from '@gis/module-verification';
import type { Db, InterruptoresDeFunciones, Registro } from '@gis/platform';
import { idReporte } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { suscribirPublicador } from '../tiempo-real/publicador.js';
import type { TiempoReal } from '../tiempo-real/servidor.js';
import { consultaDeAutor, consultaParaVerificacion } from './puentes.js';

/**
 * Hasta las Fases 8 y 9 (Web Push y Telegram), los avisos a suscriptores quedan en el log.
 * Solo se registran identificadores y la ubicación pública.
 */
export class EnviadorDeNotificacionesEnRegistro implements EnviadorDeNotificaciones {
  constructor(private readonly registro: Registro) {}

  enviar(aviso: AvisoDeReporte): Promise<void> {
    this.registro.info(
      {
        idUsuario: aviso.idUsuario,
        idReporte: aviso.idReporte,
        categoria: aviso.codigoCategoria,
        publicLocation: aviso.publicLocation,
      },
      'aviso a suscriptor',
    );
    return Promise.resolve();
  }
}

export interface DependenciasManejadores {
  readonly bus: BusDeEventos;
  readonly db: Db;
  readonly interruptores: InterruptoresDeFunciones;
  readonly registro: Registro;
  readonly tiempoReal: Pick<TiempoReal, 'difundir'>;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

export function suscribirManejadores(deps: DependenciasManejadores): void {
  const { bus, db, interruptores, reloj, ids } = deps;
  const reportes = new RepositorioReportesPostgis(db);
  const transicion = { reportes, unidadDeTrabajo: new UnidadDeTrabajoReportePg(db), reloj, ids };
  const voto = {
    consultaDeReporte: consultaParaVerificacion(reportes),
    votos: new RepositorioVotosPg(db),
    reputaciones: new RepositorioReputacionesPg(db),
    unidadDeTrabajo: new UnidadDeTrabajoVotoPg(db),
    reloj,
    ids,
  };

  const decision = new AplicarDecisionDeVerificacion(transicion);
  bus.suscribir('VotoEmitido.v1', 'reports.aplicar-decision', (e) => decision.manejar(e));

  const rechazo = new AplicarRechazoDeModeracion(transicion);
  bus.suscribir('RechazoDeModeracion.v1', 'reports.aplicar-rechazo', (e) => rechazo.manejar(e));

  const duplicado = new RegistrarConfirmacionPorDuplicado(voto);
  bus.suscribir('ReporteDuplicadoDetectado.v1', 'verification.confirmar-duplicado', (e) =>
    duplicado.manejar(e),
  );

  const reputacion = new AjustarReputacionPorDesenlace(voto);
  for (const clave of AjustarReputacionPorDesenlace.eventos) {
    bus.suscribir(clave, 'verification.ajustar-reputacion', (e) => reputacion.manejar(e));
  }

  if (interruptores.estaActivo('subscriptions')) {
    const notificar = new NotificarSuscriptores({
      suscripciones: new RepositorioSuscripcionesPg(db),
      consultaDeAutor: consultaDeAutor(reportes),
      enviador: new EnviadorDeNotificacionesEnRegistro(deps.registro),
    });
    bus.suscribir('ReporteCreado.v1', 'subscriptions.notificar', async (e) => {
      await notificar.manejar(e);
    });
  }

  suscribirPublicador(bus, deps.tiempoReal, async (id) => {
    const reporte = await reportes.buscarPorId(idReporte(id));
    return reporte?.publicLocation ?? null;
  });
}
