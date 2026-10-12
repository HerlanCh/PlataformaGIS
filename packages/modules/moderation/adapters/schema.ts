import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Auditoría de moderación: quién decidió qué sobre qué reporte y por qué. Solo se inserta. */
export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: uuid().primaryKey(),
    // Reporte del módulo `reports` y moderador de `identity`: IDs sin clave foránea (ADR-001).
    reportId: uuid('report_id').notNull(),
    moderatorId: uuid('moderator_id').notNull(),
    action: text().notNull(),
    reason: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check('moderation_actions_action_check', sql`${tabla.action} in ('RECHAZAR', 'MANTENER')`),
    // Todo rechazo lleva su motivo.
    check(
      'moderation_actions_reason_check',
      sql`${tabla.action} <> 'RECHAZAR' or coalesce(length(trim(${tabla.reason})), 0) > 0`,
    ),
    index('moderation_actions_report_idx').on(tabla.reportId),
  ],
);
