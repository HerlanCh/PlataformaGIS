import type { PuntoGeo, IdReporte, IdUsuario } from '@gis/shared-kernel';
import {
  ErrorYaVoto,
  ErrorAutorNoPuedeVotar,
  ErrorReporteNoActivo,
  ErrorDemasiadoLejosParaVotar,
} from './errors.js';
import type { InstantaneaDeReporte } from './report-snapshot.js';
import type { Reputacion } from './reputation.js';

export type ValorVoto = 'CONFIRMACION' | 'NEGACION';

/** Distancia máxima entre el votante y la ubicación real del reporte (SRS 3.2.2). */
export const DISTANCIA_MAX_VOTO_M = 1000;

export interface PropsVoto {
  readonly idReporte: IdReporte;
  readonly idVotante: IdUsuario;
  readonly valor: ValorVoto;
  /** Reputación del votante en el momento de votar. */
  readonly peso: number;
  readonly emitidoEn: Date;
}

export interface EntradaEmitirVoto {
  readonly reporte: InstantaneaDeReporte;
  readonly votante: Reputacion;
  readonly ubicacionVotante: PuntoGeo;
  readonly valor: ValorVoto;
  /** Si el votante ya tiene un voto sobre este reporte. */
  readonly yaVoto: boolean;
  readonly ahora: Date;
}

const VIGENTES: readonly InstantaneaDeReporte['estado'][] = ['ACTIVO', 'CONFIRMADO'];

/** Voto de un usuario sobre un reporte ("¿Sigue ahí?"). Inmutable. */
export class Voto {
  readonly idReporte: IdReporte;
  readonly idVotante: IdUsuario;
  readonly valor: ValorVoto;
  readonly peso: number;
  readonly emitidoEn: Date;

  private constructor(props: PropsVoto) {
    this.idReporte = props.idReporte;
    this.idVotante = props.idVotante;
    this.valor = props.valor;
    this.peso = props.peso;
    this.emitidoEn = props.emitidoEn;
    Object.freeze(this);
  }

  /**
   * Emite un voto aplicando las reglas del SRS 3.2.2. El voto de un usuario
   * silenciado se registra con peso 0.
   * @throws {ErrorReporteNoActivo} si el reporte ya no está vigente.
   * @throws {ErrorAutorNoPuedeVotar} si el votante es el autor.
   * @throws {ErrorYaVoto} si ya votó sobre este reporte.
   * @throws {ErrorDemasiadoLejosParaVotar} si está a más de 1000 m.
   */
  static emitir(input: EntradaEmitirVoto): Voto {
    const {
      reporte: report,
      votante: voter,
      ubicacionVotante: voterLocation,
      valor: valor,
      yaVoto: alreadyVoted,
      ahora: now,
    } = input;

    if (!VIGENTES.includes(report.estado)) throw new ErrorReporteNoActivo();
    if (voter.idUsuario === report.authorId) throw new ErrorAutorNoPuedeVotar();
    if (alreadyVoted) throw new ErrorYaVoto();
    if (voterLocation.distanciaA(report.location) > DISTANCIA_MAX_VOTO_M) {
      throw new ErrorDemasiadoLejosParaVotar(DISTANCIA_MAX_VOTO_M);
    }

    return new Voto({
      idReporte: report.id,
      idVotante: voter.idUsuario,
      valor: valor,
      peso: voter.puntaje,
      emitidoEn: now,
    });
  }

  /** Reconstruye un voto ya persistido. */
  static restaurar(props: PropsVoto): Voto {
    return new Voto(props);
  }
}
