import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Auditoría de moderación: quién decidió qué sobre qué reporte y por qué. Solo se inserta. */
export const moderationActions = pgTable(
  'acciones_moderacion',
  {
    id: uuid().primaryKey(),
    // Reporte del módulo `reports` y moderador de `identity`: IDs sin clave foránea (ADR-001).
    reportId: uuid('id_reporte').notNull(),
    moderatorId: uuid('id_moderador').notNull(),
    action: text('accion').notNull(),
    reason: text('motivo'),
    createdAt: timestamp('creado_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check('acciones_moderacion_accion_check', sql`${tabla.action} in ('RECHAZAR', 'MANTENER')`),
    // Todo rechazo lleva su motivo.
    check(
      'acciones_moderacion_motivo_check',
      sql`${tabla.action} <> 'RECHAZAR' or coalesce(length(trim(${tabla.reason})), 0) > 0`,
    ),
    index('acciones_moderacion_reporte_idx').on(tabla.reportId),
  ],
);
