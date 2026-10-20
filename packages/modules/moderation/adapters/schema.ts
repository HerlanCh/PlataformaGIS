import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

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

/**
 * Cola de moderación (HU-12 y HU-10): un caso por reporte negado o marcado por el clasificador.
 * Sale de la cola (`resuelto_en`) cuando un moderador decide o el reporte deja de estar vigente.
 */
export const colaModeracion = pgTable(
  'cola_moderacion',
  {
    // Reporte del módulo `reports`: ID sin clave foránea (ADR-001).
    idReporte: uuid('id_reporte').primaryKey(),
    negaciones: integer('negaciones').notNull(),
    marcado: boolean('marcado').notNull(),
    motivos: text('motivos').array().notNull(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull(),
    resueltoEn: timestamp('resuelto_en', { withTimezone: true }),
  },
  (tabla) => [
    check('cola_moderacion_negaciones_check', sql`${tabla.negaciones} >= 0`),
    // Solo los pendientes, en el orden de revisión.
    index('cola_moderacion_pendientes_idx')
      .on(tabla.marcado.desc(), tabla.negaciones.desc(), tabla.actualizadoEn)
      .where(sql`${tabla.resueltoEn} is null`),
  ],
);
