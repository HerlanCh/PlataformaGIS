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

export const categorias = pgTable(
  'categorias',
  {
    codigo: text('codigo').primaryKey(),
    nombre: text('nombre').notNull(),
    ttlMinutos: integer('ttl_minutos').notNull(),
    radioDuplicadoM: integer('radio_duplicado_m').notNull(),
    esSensible: boolean('es_sensible').notNull(),
  },
  (tabla) => [
    check('categorias_ttl_check', sql`${tabla.ttlMinutos} > 0`),
    check('categorias_radio_duplicado_check', sql`${tabla.radioDuplicadoM} > 0`),
  ],
);

export const reportes = pgTable(
  'reportes',
  {
    id: uuid().primaryKey(),
    codigoCategoria: text('codigo_categoria')
      .notNull()
      .references(() => categorias.codigo),
    // Usuario del módulo `identity`: se guarda el ID sin clave foránea (ADR-001).
    authorId: uuid('id_autor').notNull(),
    estado: text('estado').notNull(),
    ttlMinutos: integer('ttl_minutos').notNull(),
    extensiones: integer('extensiones').notNull(),
    motivoRechazo: text('motivo_rechazo'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull(),
    caducaEn: timestamp('caduca_en', { withTimezone: true }).notNull(),
    /** Ubicación real. Nunca se expone. */
    location: geometry('ubicacion', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
    /** Ubicación que se muestra; la calcula `PoliticaDePrivacidad` en el dominio. */
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
      sql`${tabla.estado} in ('ACTIVO', 'CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO')`,
    ),
    check('reportes_extensiones_check', sql`${tabla.extensiones} between 0 and 2`),
    check(
      'reportes_motivo_rechazo_check',
      sql`${tabla.motivoRechazo} is null or ${tabla.motivoRechazo} in ('MODERACION', 'AUTOR_SILENCIADO')`,
    ),
    // ST_DWithin sobre geography mide en metros; solo este índice funcional lo acelera.
    index('reportes_ubicacion_geography_idx').using('gist', sql`(${tabla.location}::geography)`),
    // Los más recientes primero (ventana del mapa) y los rangos de fechas (mapa de calor).
    index('reportes_creado_en_idx').on(tabla.creadoEn),
    index('reportes_ubicacion_publica_idx').using('gist', tabla.publicLocation),
    // Solo los reportes vigentes: los que se muestran en el mapa y los que pueden caducar.
    index('reportes_vigentes_idx')
      .on(tabla.estado, tabla.caducaEn)
      .where(sql`${tabla.estado} in ('ACTIVO', 'CONFIRMADO')`),
  ],
);
