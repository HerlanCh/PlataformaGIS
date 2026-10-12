import type { IdUsuario } from '@gis/shared-kernel';

/** Parámetros de reputación (SRS 3.2.1 y 3.2.7). */
export const REPUTACION = {
  inicial: 1.0,
  minimo: 0.0,
  maximo: 5.0,
  /** Reputación con la que vuelve un usuario silenciado. */
  recuperado: 0.5,
  /** Días sin penalización tras los que un silenciado se recupera. */
  diasDeRecuperacion: 30,
} as const;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Dos decimales: evita que la suma repetida de 0,05 acumule error de coma flotante.
const redondear = (valor: number): number => Math.round(valor * 100) / 100;
const acotar = (valor: number): number =>
  Math.min(REPUTACION.maximo, Math.max(REPUTACION.minimo, valor));

export interface PropsReputacion {
  readonly idUsuario: IdUsuario;
  readonly puntaje: number;
  readonly ultimaPenalizacionEn: Date | null;
}

/** Reputación de un usuario. Determina el peso de sus votos. */
export class Reputacion {
  private constructor(private props: PropsReputacion) {}

  /** Reputación base de todo usuario nuevo. */
  static inicial(idUsuario: IdUsuario): Reputacion {
    return new Reputacion({
      idUsuario: idUsuario,
      puntaje: REPUTACION.inicial,
      ultimaPenalizacionEn: null,
    });
  }

  /** Reconstruye una reputación ya persistida. */
  static restaurar(props: PropsReputacion): Reputacion {
    return new Reputacion(props);
  }

  get idUsuario(): IdUsuario {
    return this.props.idUsuario;
  }

  get puntaje(): number {
    return this.props.puntaje;
  }

  get ultimaPenalizacionEn(): Date | null {
    return this.props.ultimaPenalizacionEn;
  }

  /** Silenciado: sus votos no cuentan y sus reportes se rechazan de inmediato. */
  get estaSilenciado(): boolean {
    return this.props.puntaje === REPUTACION.minimo;
  }

  /** Suma reputación, hasta el máximo. Un usuario silenciado no gana reputación: solo se recupera con el tiempo. */
  premiar(amount: number): void {
    if (this.estaSilenciado) return;
    this.props = { ...this.props, puntaje: acotar(redondear(this.props.puntaje + amount)) };
  }

  /** Resta reputación, hasta el mínimo, y anota la fecha para el plazo de recuperación. */
  penalizar(amount: number, now: Date): void {
    this.props = {
      ...this.props,
      puntaje: acotar(redondear(this.props.puntaje - amount)),
      ultimaPenalizacionEn: now,
    };
  }

  /**
   * Devuelve la reputación a 0.5 si el usuario está silenciado y pasaron 30 días
   * desde su última penalización. Indica si hubo recuperación.
   */
  recuperarSiCorresponde(now: Date): boolean {
    const { ultimaPenalizacionEn: ultimaPenalizacionEn } = this.props;
    if (!this.estaSilenciado || ultimaPenalizacionEn === null) return false;

    const plazo = ultimaPenalizacionEn.getTime() + REPUTACION.diasDeRecuperacion * MS_POR_DIA;
    if (now.getTime() < plazo) return false;

    this.props = { ...this.props, puntaje: REPUTACION.recuperado };
    return true;
  }
}
