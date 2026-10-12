import { sql } from 'drizzle-orm';
import { check, numeric, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Reputación y pesos: entre 0.00 y 5.00, con los dos decimales que maneja el dominio.
const puntaje = (nombre: string) => numeric(nombre, { precision: 3, scale: 2, mode: 'number' });

export const votes = pgTable(
  'votes',
  {
    // Reporte del módulo `reports` y usuario de `identity`: IDs sin clave foránea (ADR-001).
    reportId: uuid('report_id').notNull(),
    userId: uuid('user_id').notNull(),
    value: text().notNull(),
    /** Reputación del votante en el momento de votar. */
    weight: puntaje('weight').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    // Un usuario vota una sola vez por reporte.
    primaryKey({ name: 'votes_pkey', columns: [tabla.reportId, tabla.userId] }),
    check('votes_value_check', sql`${tabla.value} in ('CONFIRMACION', 'NEGACION')`),
    check('votes_weight_check', sql`${tabla.weight} between 0 and 5`),
  ],
);

export const reputations = pgTable(
  'reputations',
  {
    userId: uuid('user_id').primaryKey(),
    score: puntaje('score').notNull(),
    lastPenaltyAt: timestamp('last_penalty_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [check('reputations_score_check', sql`${tabla.score} between 0 and 5`)],
);
