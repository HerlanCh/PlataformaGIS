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
  'zone_subscriptions',
  {
    id: uuid().primaryKey(),
    // Usuario del módulo `identity`: se guarda el ID sin clave foránea (ADR-001).
    userId: uuid('user_id').notNull(),
    /** `geography`: las distancias al centro se miden en metros. */
    center: geographyPoint().notNull(),
    radiusM: integer('radius_m').notNull(),
    // Códigos de categoría del módulo `reports`, sin clave foránea (ADR-001).
    categories: text().array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check('zone_subscriptions_radius_check', sql`${tabla.radiusM} between 100 and 2000`),
    check('zone_subscriptions_categories_check', sql`cardinality(${tabla.categories}) > 0`),
    index('zone_subscriptions_center_idx').using('gist', tabla.center),
    index('zone_subscriptions_user_idx').on(tabla.userId),
  ],
);
