import type { EventoDeIntegracion } from '@gis/contracts';
import type { IdReporte, IdUsuario } from '@gis/shared-kernel';
import type { UnidadDeTrabajoDeVoto } from '../application/ports.js';
import { ErrorYaVoto } from '../domain/errors.js';
import type {
  ConsultaDeReporte,
  RepositorioDeReputaciones,
  RepositorioDeVotos,
} from '../domain/ports.js';
import type { InstantaneaDeReporte } from '../domain/report-snapshot.js';
import { Reputacion } from '../domain/reputation.js';
import type { Voto } from '../domain/vote.js';

export class ConsultaDeReporteFalsa implements ConsultaDeReporte {
  readonly reportes = new Map<IdReporte, InstantaneaDeReporte>();

  buscarPorId(id: IdReporte): Promise<InstantaneaDeReporte | null> {
    return Promise.resolve(this.reportes.get(id) ?? null);
  }
}

export class VotosEnMemoria implements RepositorioDeVotos {
  readonly filas: Voto[] = [];

  buscarPorReporte(idReporte: IdReporte): Promise<readonly Voto[]> {
    return Promise.resolve(this.filas.filter((v) => v.idReporte === idReporte));
  }

  existe(idReporte: IdReporte, idVotante: IdUsuario): Promise<boolean> {
    return Promise.resolve(
      this.filas.some((v) => v.idReporte === idReporte && v.idVotante === idVotante),
    );
  }

  async guardar(voto: Voto): Promise<void> {
    if (await this.existe(voto.idReporte, voto.idVotante)) throw new ErrorYaVoto();
    this.filas.push(voto);
  }
}

export class ReputacionesEnMemoria implements RepositorioDeReputaciones {
  private readonly filas = new Map<IdUsuario, Reputacion>();

  buscarPorUsuario(idUsuario: IdUsuario): Promise<Reputacion | null> {
    const fila = this.filas.get(idUsuario);
    return Promise.resolve(fila ? Reputacion.restaurar({ ...this.props(fila) }) : null);
  }

  guardar(reputacion: Reputacion): Promise<void> {
    this.filas.set(reputacion.idUsuario, Reputacion.restaurar(this.props(reputacion)));
    return Promise.resolve();
  }

  /** Puntaje guardado, o `undefined` si el usuario nunca tuvo reputación guardada. */
  puntaje(idUsuario: IdUsuario): number | undefined {
    return this.filas.get(idUsuario)?.puntaje;
  }

  private props(reputacion: Reputacion) {
    return {
      idUsuario: reputacion.idUsuario,
      puntaje: reputacion.puntaje,
      ultimaPenalizacionEn: reputacion.ultimaPenalizacionEn,
    };
  }
}

export class UnidadDeTrabajoVotoEnMemoria implements UnidadDeTrabajoDeVoto {
  readonly eventos: EventoDeIntegracion[] = [];

  constructor(
    private readonly votos: VotosEnMemoria,
    private readonly reputaciones: ReputacionesEnMemoria,
  ) {}

  async registrarVoto(
    voto: Voto,
    votante: Reputacion,
    eventos: readonly EventoDeIntegracion[],
  ): Promise<void> {
    await this.votos.guardar(voto);
    await this.reputaciones.guardar(votante);
    this.eventos.push(...eventos);
  }

  async guardarReputaciones(reputaciones: readonly Reputacion[]): Promise<void> {
    for (const reputacion of reputaciones) await this.reputaciones.guardar(reputacion);
  }
}
