import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Patrón outbox: los eventos de integración se guardan en la misma transacción que el
 * agregado y un despachador los publica después (Fase 7). Tabla compartida, sin dueño de negocio.
 */
export const eventosSalida = pgTable(
  'eventos_salida',
  {
    id: uuid().primaryKey(),
    /** Clave del evento: `ReporteCreado.v1`. */
    tipo: text('tipo').notNull(),
    /** El evento de integración completo. */
    contenido: jsonb('contenido').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    publicadoEn: timestamp('publicado_en', { withTimezone: true }),
  },
  (tabla) => [
    // El despachador solo recorre los pendientes, en orden de llegada.
    index('eventos_salida_pendientes_idx')
      .on(tabla.creadoEn)
      .where(sql`${tabla.publicadoEn} is null`),
  ],
);
