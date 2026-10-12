import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  geometry,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const categories = pgTable(
  'categories',
  {
    code: text().primaryKey(),
    name: text().notNull(),
    ttlMinutes: integer('ttl_minutes').notNull(),
    dedupRadiusM: integer('dedup_radius_m').notNull(),
    isSensitive: boolean('is_sensitive').notNull(),
  },
  (tabla) => [
    check('categories_ttl_check', sql`${tabla.ttlMinutes} > 0`),
    check('categories_dedup_radius_check', sql`${tabla.dedupRadiusM} > 0`),
  ],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid().primaryKey(),
    categoryCode: text('category_code')
      .notNull()
      .references(() => categories.code),
    // Usuario del módulo `identity`: se guarda el ID sin clave foránea (ADR-001).
    authorId: uuid('author_id').notNull(),
    status: text().notNull(),
    ttlMinutes: integer('ttl_minutes').notNull(),
    extensions: integer().notNull(),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Ubicación real. Nunca se expone. */
    location: geometry({ type: 'point', mode: 'xy', srid: 4326 }).notNull(),
    /** Ubicación que se muestra; la calcula `PrivacyPolicy` en el dominio. */
    publicLocation: geometry('public_location', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }).notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
  },
  (tabla) => [
    check(
      'reports_status_check',
      sql`${tabla.status} in ('ACTIVO', 'CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO')`,
    ),
    check('reports_extensions_check', sql`${tabla.extensions} between 0 and 2`),
    check(
      'reports_rejection_reason_check',
      sql`${tabla.rejectionReason} is null or ${tabla.rejectionReason} in ('MODERACION', 'AUTOR_SILENCIADO')`,
    ),
    index('reports_location_idx').using('gist', tabla.location),
    index('reports_public_location_idx').using('gist', tabla.publicLocation),
    // Solo los reportes vigentes: los que se muestran en el mapa y los que pueden caducar.
    index('reports_vigentes_idx')
      .on(tabla.status, tabla.expiresAt)
      .where(sql`${tabla.status} in ('ACTIVO', 'CONFIRMADO')`),
  ],
);
