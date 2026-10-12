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
  'categorias',
  {
    code: text('codigo').primaryKey(),
    name: text('nombre').notNull(),
    ttlMinutes: integer('ttl_minutos').notNull(),
    dedupRadiusM: integer('radio_duplicado_m').notNull(),
    isSensitive: boolean('es_sensible').notNull(),
  },
  (tabla) => [
    check('categorias_ttl_check', sql`${tabla.ttlMinutes} > 0`),
    check('categorias_radio_duplicado_check', sql`${tabla.dedupRadiusM} > 0`),
  ],
);

export const reports = pgTable(
  'reportes',
  {
    id: uuid().primaryKey(),
    categoryCode: text('codigo_categoria')
      .notNull()
      .references(() => categories.code),
    // Usuario del módulo `identity`: se guarda el ID sin clave foránea (ADR-001).
    authorId: uuid('id_autor').notNull(),
    status: text('estado').notNull(),
    ttlMinutes: integer('ttl_minutos').notNull(),
    extensions: integer('extensiones').notNull(),
    rejectionReason: text('motivo_rechazo'),
    createdAt: timestamp('creado_en', { withTimezone: true }).notNull(),
    expiresAt: timestamp('caduca_en', { withTimezone: true }).notNull(),
    /** Ubicación real. Nunca se expone. */
    location: geometry('ubicacion', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
    /** Ubicación que se muestra; la calcula `PrivacyPolicy` en el dominio. */
    publicLocation: geometry('ubicacion_publica', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }).notNull(),
    idempotencyKey: text('clave_idempotencia').notNull().unique(),
  },
  (tabla) => [
    check(
      'reportes_estado_check',
      sql`${tabla.status} in ('ACTIVO', 'CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO')`,
    ),
    check('reportes_extensiones_check', sql`${tabla.extensions} between 0 and 2`),
    check(
      'reportes_motivo_rechazo_check',
      sql`${tabla.rejectionReason} is null or ${tabla.rejectionReason} in ('MODERACION', 'AUTOR_SILENCIADO')`,
    ),
    index('reportes_ubicacion_idx').using('gist', tabla.location),
    index('reportes_ubicacion_publica_idx').using('gist', tabla.publicLocation),
    // Solo los reportes vigentes: los que se muestran en el mapa y los que pueden caducar.
    index('reportes_vigentes_idx')
      .on(tabla.status, tabla.expiresAt)
      .where(sql`${tabla.status} in ('ACTIVO', 'CONFIRMADO')`),
  ],
);
