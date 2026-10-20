import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Historial de clasificaciones (HU-10): una fila cada vez que se clasifica un reporte, al crearlo y
 * al describirlo. Solo se inserta.
 */
export const clasificaciones = pgTable(
  'clasificaciones',
  {
    id: uuid().primaryKey(),
    // Reporte del módulo `reports`: ID sin clave foránea (ADR-001).
    idReporte: uuid('id_reporte').notNull(),
    sospechoso: boolean('sospechoso').notNull(),
    motivos: text('motivos').array().notNull(),
    puntaje: real('puntaje').notNull(),
    clasificador: text('clasificador').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check('clasificaciones_puntaje_check', sql`${tabla.puntaje} between 0 and 1`),
    index('clasificaciones_reporte_idx').on(tabla.idReporte),
  ],
);
