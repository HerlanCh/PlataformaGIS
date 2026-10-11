import type { IntegrationEvent } from '@gis/contracts';

export type EventHandler = (event: IntegrationEvent) => void | Promise<void>;

/** Cancela la suscripción que la devolvió. */
export type Unsubscribe = () => void;

/**
 * Puerto del bus de eventos. Quien publica no sabe quién escucha.
 * La clave tiene la forma `Tipo.vN` (ver `eventKey` en contracts).
 */
export interface EventBus {
  publish(event: IntegrationEvent): Promise<void>;
  subscribe(key: string, handler: EventHandler): Unsubscribe;
}
