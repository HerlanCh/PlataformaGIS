import { ErrorDeDominio } from '@gis/shared-kernel';
import type { IdReporte, IdUsuario, Marca } from '@gis/shared-kernel';

export type IdAccionDeModeracion = Marca<string, 'IdAccionDeModeracion'>;

export type TipoDeAccion = 'RECHAZAR' | 'MANTENER';

export class ErrorMotivoObligatorio extends ErrorDeDominio {
  constructor() {
    super('MOTIVO_OBLIGATORIO', 'Todo rechazo debe indicar su motivo');
  }
}

export interface PropsAccionDeModeracion {
  readonly id: IdAccionDeModeracion;
  readonly idReporte: IdReporte;
  readonly idModerador: IdUsuario;
  readonly accion: TipoDeAccion;
  readonly motivo: string | null;
  readonly creadoEn: Date;
}

export interface EntradaRechazo {
  readonly id: IdAccionDeModeracion;
  readonly idReporte: IdReporte;
  readonly idModerador: IdUsuario;
  readonly motivo: string;
  readonly ahora: Date;
}

export interface EntradaMantener extends Omit<EntradaRechazo, 'motivo'> {
  readonly motivo?: string | null;
}

/** Registro de auditoría de una decisión de moderación (HU-12). Inmutable: solo se inserta. */
export class AccionDeModeracion {
  readonly id: IdAccionDeModeracion;
  readonly idReporte: IdReporte;
  readonly idModerador: IdUsuario;
  readonly accion: TipoDeAccion;
  readonly motivo: string | null;
  readonly creadoEn: Date;

  private constructor(props: PropsAccionDeModeracion) {
    this.id = props.id;
    this.idReporte = props.idReporte;
    this.idModerador = props.idModerador;
    this.accion = props.accion;
    this.motivo = props.motivo;
    this.creadoEn = props.creadoEn;
    Object.freeze(this);
  }

  /** @throws {ErrorMotivoObligatorio} si el motivo está vacío. */
  static rechazo(entrada: EntradaRechazo): AccionDeModeracion {
    const motivo = entrada.motivo.trim();
    if (motivo === '') throw new ErrorMotivoObligatorio();
    return new AccionDeModeracion({
      id: entrada.id,
      idReporte: entrada.idReporte,
      idModerador: entrada.idModerador,
      accion: 'RECHAZAR',
      motivo,
      creadoEn: entrada.ahora,
    });
  }

  /** El moderador revisó el reporte y lo deja publicado. El motivo es opcional. */
  static mantener(entrada: EntradaMantener): AccionDeModeracion {
    const motivo = entrada.motivo?.trim() ?? '';
    return new AccionDeModeracion({
      id: entrada.id,
      idReporte: entrada.idReporte,
      idModerador: entrada.idModerador,
      accion: 'MANTENER',
      motivo: motivo === '' ? null : motivo,
      creadoEn: entrada.ahora,
    });
  }

  static restaurar(props: PropsAccionDeModeracion): AccionDeModeracion {
    return new AccionDeModeracion(props);
  }
}
