import { sql } from 'drizzle-orm';
import { check, numeric, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Reputación y pesos: entre 0.00 y 5.00, con los dos decimales que maneja el dominio.
const puntaje = (nombre: string) => numeric(nombre, { precision: 3, scale: 2, mode: 'number' });

export const votes = pgTable(
  'votos',
  {
    // Reporte del módulo `reports` y usuario de `identity`: IDs sin clave foránea (ADR-001).
    reportId: uuid('id_reporte').notNull(),
    userId: uuid('id_usuario').notNull(),
    value: text('valor').notNull(),
    /** Reputación del votante en el momento de votar. */
    weight: puntaje('peso').notNull(),
    createdAt: timestamp('creado_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    // Un usuario vota una sola vez por reporte.
    primaryKey({ name: 'votos_pkey', columns: [tabla.reportId, tabla.userId] }),
    check('votos_valor_check', sql`${tabla.value} in ('CONFIRMACION', 'NEGACION')`),
    check('votos_peso_check', sql`${tabla.weight} between 0 and 5`),
  ],
);

export const reputations = pgTable(
  'reputaciones',
  {
    userId: uuid('id_usuario').primaryKey(),
    score: puntaje('puntaje').notNull(),
    lastPenaltyAt: timestamp('ultima_penalizacion_en', { withTimezone: true }),
    updatedAt: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [check('reputaciones_puntaje_check', sql`${tabla.score} between 0 and 5`)],
);
