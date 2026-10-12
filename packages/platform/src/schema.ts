import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Patrón outbox: los eventos de integración se guardan en la misma transacción que el
 * agregado y un despachador los publica después (Fase 7). Tabla compartida, sin dueño de negocio.
 */
export const outboxEvents = pgTable(
  'eventos_salida',
  {
    id: uuid().primaryKey(),
    /** Clave del evento: `ReportCreated.v1`. */
    type: text('tipo').notNull(),
    /** El evento de integración completo. */
    payload: jsonb('contenido').notNull(),
    createdAt: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('publicado_en', { withTimezone: true }),
  },
  (tabla) => [
    // El despachador solo recorre los pendientes, en orden de llegada.
    index('eventos_salida_pendientes_idx')
      .on(tabla.createdAt)
      .where(sql`${tabla.publishedAt} is null`),
  ],
);
