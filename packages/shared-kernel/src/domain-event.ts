export interface DomainEventProps {
  readonly id: string;
  readonly occurredAt: Date;
}

/** Clase base de todo evento. `type` y `version` identifican el contrato publicado. */
export abstract class DomainEvent {
  abstract readonly type: string;
  abstract readonly version: number;
  readonly id: string;
  readonly occurredAt: Date;

  constructor(props: DomainEventProps) {
    this.id = props.id;
    this.occurredAt = props.occurredAt;
  }
}
