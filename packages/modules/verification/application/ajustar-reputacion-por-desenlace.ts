import {
  claveDeEvento,
  leerContenido,
  reporteConfirmadoV1,
  reporteRechazadoV1,
  reporteResueltoV1,
} from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import { idReporte } from '@gis/shared-kernel';
import type { IdReporte, IdUsuario, Reloj } from '@gis/shared-kernel';
import type {
  ConsultaDeReporte,
  RepositorioDeReputaciones,
  RepositorioDeVotos,
} from '../domain/ports.js';
import { AJUSTES_DE_REPUTACION, PoliticaDeReputacion } from '../domain/reputation-policy.js';
import type { DesenlaceVotado } from '../domain/reputation-policy.js';
import type { Reputacion } from '../domain/reputation.js';
import { reputacionDe } from './emitir-voto.js';
import type { UnidadDeTrabajoDeVoto } from './ports.js';

export interface DependenciasAjustarReputacion {
  readonly consultaDeReporte: ConsultaDeReporte;
  readonly votos: RepositorioDeVotos;
  readonly reputaciones: RepositorioDeReputaciones;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeVoto;
  readonly reloj: Reloj;
}

/**
 * Manejador de los desenlaces de un reporte (SRS 3.2.6). Reacciona al estado que `reports`
 * aplicó de verdad, no a la decisión del voto: si el cambio no llegó a aplicarse, nadie gana
 * ni pierde reputación.
 * - `ReporteConfirmado`: +0,20 al autor y +0,05 a quienes confirmaron.
 * - `ReporteResuelto`: +0,05 a quienes negaron.
 * - `ReporteRechazado`: la penalización al autor que fije `PoliticaDeReputacion`.
 */
export class AjustarReputacionPorDesenlace {
  constructor(private readonly deps: DependenciasAjustarReputacion) {}

  /** Claves de los eventos que escucha. */
  static readonly eventos = [
    reporteConfirmadoV1.clave,
    reporteResueltoV1.clave,
    reporteRechazadoV1.clave,
  ];

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    switch (claveDeEvento(evento)) {
      case reporteConfirmadoV1.clave: {
        const { idReporte: id } = leerContenido(reporteConfirmadoV1, evento);
        return this.alConfirmar(idReporte(id));
      }
      case reporteResueltoV1.clave: {
        const { idReporte: id } = leerContenido(reporteResueltoV1, evento);
        return this.guardar(await this.votantesAcertados(idReporte(id), 'RESUELTO'));
      }
      case reporteRechazadoV1.clave: {
        const { idReporte: id, motivo } = leerContenido(reporteRechazadoV1, evento);
        return this.alRechazar(idReporte(id), PoliticaDeReputacion.penalizacionPorRechazo(motivo));
      }
      default:
        throw new Error(`AjustarReputacionPorDesenlace no maneja ${claveDeEvento(evento)}`);
    }
  }

  private async alConfirmar(id: IdReporte): Promise<void> {
    const autor = await this.autor(id);
    const votantes = await this.votantesAcertados(id, 'CONFIRMADO');
    if (autor) autor.premiar(AJUSTES_DE_REPUTACION.reporteConfirmado);
    await this.guardar(autor ? [autor, ...votantes] : votantes);
  }

  private async alRechazar(id: IdReporte, penalizacion: number): Promise<void> {
    if (penalizacion === 0) return;
    const autor = await this.autor(id);
    if (!autor) return;
    autor.penalizar(penalizacion, this.deps.reloj.ahora());
    await this.guardar([autor]);
  }

  private async autor(id: IdReporte): Promise<Reputacion | null> {
    const reporte = await this.deps.consultaDeReporte.buscarPorId(id);
    return reporte ? this.reputacion(reporte.authorId) : null;
  }

  /** Reputaciones de quienes votaron en el sentido del desenlace, ya premiadas. */
  private async votantesAcertados(
    id: IdReporte,
    desenlace: DesenlaceVotado,
  ): Promise<Reputacion[]> {
    const votos = await this.deps.votos.buscarPorReporte(id);
    const acertados = PoliticaDeReputacion.votantesAcertados(votos, desenlace);
    const reputaciones = await Promise.all(acertados.map((id) => this.reputacion(id)));
    for (const reputacion of reputaciones) reputacion.premiar(AJUSTES_DE_REPUTACION.votoAcertado);
    return reputaciones;
  }

  private reputacion(idUsuario: IdUsuario): Promise<Reputacion> {
    return reputacionDe(this.deps.reputaciones, idUsuario);
  }

  private async guardar(reputaciones: readonly Reputacion[]): Promise<void> {
    if (reputaciones.length > 0) await this.deps.unidadDeTrabajo.guardarReputaciones(reputaciones);
  }
}
