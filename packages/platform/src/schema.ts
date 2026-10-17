import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

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
    /** Entregas fallidas. Al llegar al máximo, el evento se da por perdido y se registra. */
    intentos: integer('intentos').notNull().default(0),
    ultimoError: text('ultimo_error'),
    /** Tras un fallo, no se reintenta antes de este momento (espera exponencial). */
    proximoIntento: timestamp('proximo_intento', { withTimezone: true }),
  },
  (tabla) => [
    // El despachador solo recorre los pendientes, en orden de llegada.
    index('eventos_salida_pendientes_idx')
      .on(tabla.creadoEn)
      .where(sql`${tabla.publicadoEn} is null`),
  ],
);

/**
 * Bandeja de entrada: qué manejador ya procesó qué evento. El despachador entrega cada evento
 * al menos una vez; esta tabla evita que un manejador lo procese dos veces al reintentar.
 */
export const eventosProcesados = pgTable(
  'eventos_procesados',
  {
    idEvento: uuid('id_evento').notNull(),
    /** Nombre estable del manejador: `verification.ajustar-reputacion`. */
    manejador: text('manejador').notNull(),
    procesadoEn: timestamp('procesado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [
    primaryKey({ name: 'eventos_procesados_pkey', columns: [tabla.idEvento, tabla.manejador] }),
  ],
);
