export interface PropsEventoDeDominio {
  readonly id: string;
  readonly ocurridoEn: Date;
}

/** Clase base de todo evento. `type` y `version` identifican el contrato publicado. */
export abstract class EventoDeDominio {
  abstract readonly tipo: string;
  abstract readonly version: number;
  readonly id: string;
  readonly ocurridoEn: Date;

  constructor(props: PropsEventoDeDominio) {
    this.id = props.id;
    this.ocurridoEn = props.ocurridoEn;
  }
}
