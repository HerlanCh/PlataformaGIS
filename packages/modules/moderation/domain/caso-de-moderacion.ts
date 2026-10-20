import type { IdReporte } from '@gis/shared-kernel';

export interface PropsCasoDeModeracion {
  readonly idReporte: IdReporte;
  /** Votos «Ya no está» recibidos. */
  readonly negaciones: number;
  /** El clasificador lo consideró sospechoso alguna vez (HU-10). */
  readonly marcado: boolean;
  /** Indicios del clasificador, sin repetir, en el orden en que aparecieron. */
  readonly motivos: readonly string[];
  readonly actualizadoEn: Date;
  /** Cuándo salió de la cola: decisión de un moderador o desenlace del reporte. */
  readonly resueltoEn: Date | null;
}

/**
 * Un reporte en la cola de moderación (HU-12): entra por negaciones de la comunidad o porque el
 * clasificador lo marcó, y sale cuando un moderador decide o el reporte deja de estar vigente.
 */
export class CasoDeModeracion {
  private constructor(private props: PropsCasoDeModeracion) {}

  static abrir(idReporte: IdReporte, ahora: Date): CasoDeModeracion {
    return new CasoDeModeracion({
      idReporte,
      negaciones: 0,
      marcado: false,
      motivos: [],
      actualizadoEn: ahora,
      resueltoEn: null,
    });
  }

  static restaurar(props: PropsCasoDeModeracion): CasoDeModeracion {
    return new CasoDeModeracion(props);
  }

  get idReporte(): IdReporte {
    return this.props.idReporte;
  }

  get negaciones(): number {
    return this.props.negaciones;
  }

  get marcado(): boolean {
    return this.props.marcado;
  }

  get motivos(): readonly string[] {
    return this.props.motivos;
  }

  get actualizadoEn(): Date {
    return this.props.actualizadoEn;
  }

  get resueltoEn(): Date | null {
    return this.props.resueltoEn;
  }

  /** En la cola: sin resolver y con algo que revisar. */
  get estaPendiente(): boolean {
    return this.props.resueltoEn === null && (this.props.marcado || this.props.negaciones > 0);
  }

  /** Una negación nueva lo devuelve a la cola aunque un moderador ya lo hubiera mantenido. */
  registrarNegacion(ahora: Date): void {
    this.props = {
      ...this.props,
      negaciones: this.props.negaciones + 1,
      actualizadoEn: ahora,
      resueltoEn: null,
    };
  }

  /** El clasificador lo marcó: suma sus motivos y lo devuelve a la cola. */
  marcar(motivos: readonly string[], ahora: Date): void {
    const nuevos = motivos.filter((m) => !this.props.motivos.includes(m));
    this.props = {
      ...this.props,
      marcado: true,
      motivos: [...this.props.motivos, ...nuevos],
      actualizadoEn: ahora,
      resueltoEn: null,
    };
  }

  /** Sale de la cola. Repetirlo no cambia la fecha original. */
  resolver(ahora: Date): void {
    if (this.props.resueltoEn !== null) return;
    this.props = { ...this.props, resueltoEn: ahora };
  }
}

/** Orden de revisión: primero lo marcado, después lo más negado y, a igualdad, lo más antiguo. */
export const compararPrioridad = (a: CasoDeModeracion, b: CasoDeModeracion): number =>
  Number(b.marcado) - Number(a.marcado) ||
  b.negaciones - a.negaciones ||
  a.actualizadoEn.getTime() - b.actualizadoEn.getTime();
