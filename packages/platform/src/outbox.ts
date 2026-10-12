import { eventKey } from '@gis/contracts';
import type { IntegrationEvent } from '@gis/contracts';
import type { Executor } from './database.js';
import { outboxEvents } from './schema.js';

/**
 * Guarda eventos de integración en el outbox. Debe llamarse con la misma transacción
 * que guarda el agregado: o se guardan ambos o ninguno.
 */
export async function appendToOutbox(
  executor: Executor,
  events: readonly IntegrationEvent[],
): Promise<void> {
  if (events.length === 0) return;
  await executor.insert(outboxEvents).values(
    events.map((event) => ({
      id: event.id,
      type: eventKey(event),
      payload: event,
      createdAt: new Date(event.occurredAt),
    })),
  );
}
