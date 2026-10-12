import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Drizzle no trae el tipo `geography`. Se escribe y se lee con SQL espacial explícito
 * en el repositorio (`ST_MakePoint`, `ST_X`, `ST_Y`), no con este mapeo.
 */
const geographyPoint = customType<{ data: string }>({
  dataType: () => 'geography(Point, 4326)',
});

export const zoneSubscriptions = pgTable(
  'zonas_suscritas',
  {
    id: uuid().primaryKey(),
    // Usuario del módulo `identity`: se guarda el ID sin clave foránea (ADR-001).
    userId: uuid('id_usuario').notNull(),
    /** `geography`: las distancias al centro se miden en metros. */
    center: geographyPoint('centro').notNull(),
    radiusM: integer('radio_m').notNull(),
    // Códigos de categoría del módulo `reports`, sin clave foránea (ADR-001).
    categories: text('categorias').array().notNull(),
    createdAt: timestamp('creado_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check('zonas_suscritas_radio_check', sql`${tabla.radiusM} between 100 and 2000`),
    check('zonas_suscritas_categorias_check', sql`cardinality(${tabla.categories}) > 0`),
    index('zonas_suscritas_centro_idx').using('gist', tabla.center),
    index('zonas_suscritas_usuario_idx').on(tabla.userId),
  ],
);
