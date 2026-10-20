// Raíz de composición de las reacciones entre módulos (Fase 7): cada manejador de evento se
// construye con sus adaptadores y se suscribe al bus con un nombre estable, que la bandeja de
// entrada (`eventos_procesados`) usa para no repetir un evento ya procesado.
import type { BusDeEventos } from '@gis/event-bus';
import {
  ClasificadorPorReglas,
  ClasificarReporte,
  UnidadDeTrabajoClasificacionPg,
} from '@gis/module-classifier';
import {
  AplicarDecisionDeVerificacion,
  AplicarRechazoDeModeracion,
  RepositorioReportesPostgis,
  UnidadDeTrabajoReportePg,
} from '@gis/module-reports';
import { ActualizarColaDeModeracion, RepositorioColaPg } from '@gis/module-moderation';
import {
  EmisorWebPush,
  EnviarAvisoPush,
  RepositorioSuscripcionesPushPg,
} from '@gis/module-notifications';
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
import type { ConfigVapid } from '../http/config-http.js';
import type { TiempoReal } from '../tiempo-real/servidor.js';
import { consultaDeAutor, consultaParaClasificar, consultaParaVerificacion } from './puentes.js';

/**
 * Avisos a suscriptores en el log: solo identificadores y la ubicación pública. Es el canal cuando
 * `notifications` está apagado o faltan las claves VAPID.
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

/**
 * Puente entre `subscriptions` y `notifications` (HU-08): el aviso a un suscriptor se envía por
 * Web Push a cada dispositivo suyo y además se registra. Vive en la raíz de composición porque un
 * módulo nunca importa a otro (ADR-001).
 */
export class EnviadorDeNotificacionesPush implements EnviadorDeNotificaciones {
  private readonly enRegistro: EnviadorDeNotificacionesEnRegistro;

  constructor(
    private readonly enviarAviso: Pick<EnviarAvisoPush, 'ejecutar'>,
    private readonly registro: Registro,
  ) {
    this.enRegistro = new EnviadorDeNotificacionesEnRegistro(registro);
  }

  async enviar(aviso: AvisoDeReporte): Promise<void> {
    await this.enRegistro.enviar(aviso);
    const resultado = await this.enviarAviso.ejecutar(aviso.idUsuario, {
      idReporte: aviso.idReporte,
      codigoCategoria: aviso.codigoCategoria,
      publicLocation: {
        latitud: aviso.publicLocation.latitud,
        longitud: aviso.publicLocation.longitud,
      },
    });
    if (resultado.fallidos > 0) {
      this.registro.warn({ idUsuario: aviso.idUsuario, ...resultado }, 'avisos push no entregados');
    }
  }
}

/** El canal de avisos según los interruptores y las claves VAPID. */
export function enviadorDeAvisos(
  db: Db,
  interruptores: InterruptoresDeFunciones,
  registro: Registro,
  vapid: ConfigVapid | null,
): EnviadorDeNotificaciones {
  if (!interruptores.estaActivo('notifications') || !vapid) {
    return new EnviadorDeNotificacionesEnRegistro(registro);
  }
  const enviar = new EnviarAvisoPush({
    suscripciones: new RepositorioSuscripcionesPushPg(db),
    emisor: new EmisorWebPush(vapid),
  });
  return new EnviadorDeNotificacionesPush(enviar, registro);
}

export interface DependenciasManejadores {
  readonly bus: BusDeEventos;
  readonly db: Db;
  readonly interruptores: InterruptoresDeFunciones;
  readonly registro: Registro;
  readonly tiempoReal: Pick<TiempoReal, 'difundir'>;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
  readonly vapid?: ConfigVapid | null;
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
      enviador: enviadorDeAvisos(db, interruptores, deps.registro, deps.vapid ?? null),
    });
    bus.suscribir('ReporteCreado.v1', 'subscriptions.notificar', async (e) => {
      await notificar.manejar(e);
    });
  }

  // HU-12 y HU-10: la cola de moderación se alimenta de votos, clasificaciones y desenlaces.
  if (interruptores.estaActivo('moderation')) {
    const cola = new ActualizarColaDeModeracion(new RepositorioColaPg(db));
    for (const clave of ActualizarColaDeModeracion.eventos) {
      bus.suscribir(clave, 'moderation.actualizar-cola', (e) => cola.manejar(e));
    }
  }

  // HU-10: clasifica de forma asíncrona, tras el outbox; crear un reporte nunca lo espera.
  if (interruptores.estaActivo('classifier')) {
    const clasificar = new ClasificarReporte({
      consulta: consultaParaClasificar(reportes),
      clasificador: new ClasificadorPorReglas(),
      unidadDeTrabajo: new UnidadDeTrabajoClasificacionPg(db),
      reloj,
      ids,
    });
    for (const clave of ClasificarReporte.eventos) {
      bus.suscribir(clave, 'classifier.clasificar', (e) => clasificar.manejar(e));
    }
  }

  suscribirPublicador(bus, deps.tiempoReal, async (id) => {
    const reporte = await reportes.buscarPorId(idReporte(id));
    return reporte?.publicLocation ?? null;
  });
}
