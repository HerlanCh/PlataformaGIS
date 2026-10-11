import { eventKey } from '@gis/contracts';
import type { IntegrationEvent } from '@gis/contracts';
import type { EventBus, EventHandler, Unsubscribe } from './event-bus.js';

export type HandlerErrorListener = (error: unknown, event: IntegrationEvent) => void;

/**
 * Bus en memoria para un solo proceso. No sobrevive a un reinicio:
 * la entrega fiable llega con el outbox de la Fase 7.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  constructor(private readonly onHandlerError: HandlerErrorListener = () => {}) {}

  subscribe(key: string, handler: EventHandler): Unsubscribe {
    const registrados = this.handlers.get(key) ?? new Set<EventHandler>();
    registrados.add(handler);
    this.handlers.set(key, registrados);
    return () => {
      registrados.delete(handler);
    };
  }

  async publish(event: IntegrationEvent): Promise<void> {
    const registrados = [...(this.handlers.get(eventKey(event)) ?? [])];
    // El fallo de un manejador no impide que los demás reciban el evento.
    const resultados = await Promise.allSettled(registrados.map(async (handler) => handler(event)));
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') this.onHandlerError(resultado.reason, event);
    }
  }
}
