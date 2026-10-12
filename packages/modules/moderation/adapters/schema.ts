import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Auditoría de moderación: quién decidió qué sobre qué reporte y por qué. Solo se inserta. */
export const accionesModeracion = pgTable(
  'acciones_moderacion',
  {
    id: uuid().primaryKey(),
    // Reporte del módulo `reports` y moderador de `identity`: IDs sin clave foránea (ADR-001).
    idReporte: uuid('id_reporte').notNull(),
    idModerador: uuid('id_moderador').notNull(),
    accion: text('accion').notNull(),
    motivo: text('motivo'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check('acciones_moderacion_accion_check', sql`${tabla.accion} in ('RECHAZAR', 'MANTENER')`),
    // Todo rechazo lleva su motivo.
    check(
      'acciones_moderacion_motivo_check',
      sql`${tabla.accion} <> 'RECHAZAR' or coalesce(length(trim(${tabla.motivo})), 0) > 0`,
    ),
    index('acciones_moderacion_reporte_idx').on(tabla.idReporte),
  ],
);
