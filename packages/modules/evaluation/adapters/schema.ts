import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  geometry,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Registro de la evaluación (ADR-007). Ninguna tabla tiene columna para el autor, el votante ni
 * la ubicación real: no los puede guardar. Los reportes son del módulo `reports`: se guarda su ID
 * sin clave foránea (ADR-001).
 */
export const evaluacionEnvios = pgTable(
  'evaluacion_envios',
  {
    /** En un envío `CREADO` es el ID del reporte; en uno `DUPLICADO`, uno propio. */
    idEnvio: uuid('id_envio').primaryKey(),
    tipo: text('tipo').notNull(),
    /** El reporte creado o, en un duplicado, el que lo absorbió. */
    idReporte: uuid('id_reporte').notNull(),
    codigoCategoria: text('codigo_categoria').notNull(),
    /** Solo la ubicación pública: centro de la celda de 200 m en las categorías sensibles. */
    publicLocation: geometry('ubicacion_publica', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }).notNull(),
    fuenteOficial: text('fuente_oficial'),
    recibidoEn: timestamp('recibido_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check('evaluacion_envios_tipo_check', sql`${tabla.tipo} in ('CREADO', 'DUPLICADO')`),
    check(
      'evaluacion_envios_fuente_oficial_check',
      sql`${tabla.fuenteOficial} is null or ${tabla.fuenteOficial} in ('TRANSITO', 'ABC', 'MI_TELEFERICO', 'OTRA')`,
    ),
    index('evaluacion_envios_ubicacion_publica_idx').using('gist', tabla.publicLocation),
    index('evaluacion_envios_recibido_en_idx').on(tabla.recibidoEn),
    index('evaluacion_envios_id_reporte_idx').on(tabla.idReporte),
  ],
);

/** Cada cambio de estado de un reporte, con la caducidad que deja (nula en los cierres). */
export const evaluacionTransiciones = pgTable(
  'evaluacion_transiciones',
  {
    idEvento: uuid('id_evento').primaryKey(),
    idReporte: uuid('id_reporte').notNull(),
    estado: text('estado').notNull(),
    caducaEn: timestamp('caduca_en', { withTimezone: true }),
    ocurridoEn: timestamp('ocurrido_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check(
      'evaluacion_transiciones_estado_check',
      sql`${tabla.estado} in ('ACTIVO', 'CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO')`,
    ),
    check(
      'evaluacion_transiciones_caducidad_check',
      sql`(${tabla.caducaEn} is null) = (${tabla.estado} in ('RESUELTO', 'CADUCADO', 'RECHAZADO'))`,
    ),
    index('evaluacion_transiciones_reporte_idx').on(tabla.idReporte, tabla.ocurridoEn),
  ],
);

/** Cada voto con su peso y la decisión que produjo, sin quién votó. */
export const evaluacionVotos = pgTable(
  'evaluacion_votos',
  {
    idEvento: uuid('id_evento').primaryKey(),
    idReporte: uuid('id_reporte').notNull(),
    valor: text('valor').notNull(),
    peso: doublePrecision('peso').notNull(),
    decision: text('decision').notNull(),
    ocurridoEn: timestamp('ocurrido_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check('evaluacion_votos_valor_check', sql`${tabla.valor} in ('CONFIRMACION', 'NEGACION')`),
    check('evaluacion_votos_peso_check', sql`${tabla.peso} between 0 and 5`),
    check(
      'evaluacion_votos_decision_check',
      sql`${tabla.decision} in ('NINGUNA', 'CONFIRMAR', 'EXTENDER', 'RESOLVER')`,
    ),
    index('evaluacion_votos_reporte_idx').on(tabla.idReporte, tabla.ocurridoEn),
  ],
);

/**
 * Instantáneas congeladas (ADR-007). Inmutables: un disparador impide modificarlas o borrarlas
 * (migración `0001_instantaneas`).
 */
export const evaluacionInstantaneas = pgTable(
  'evaluacion_instantaneas',
  {
    id: uuid('id').primaryKey(),
    nombre: text('nombre').notNull().unique(),
    instante: timestamp('instante', { withTimezone: true }).notNull(),
    latitudMin: doublePrecision('latitud_min').notNull(),
    latitudMax: doublePrecision('latitud_max').notNull(),
    longitudMin: doublePrecision('longitud_min').notNull(),
    longitudMax: doublePrecision('longitud_max').notNull(),
    creadaEn: timestamp('creada_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check(
      'evaluacion_instantaneas_nombre_check',
      sql`char_length(${tabla.nombre}) between 1 and 40`,
    ),
    check(
      'evaluacion_instantaneas_caja_check',
      sql`${tabla.latitudMin} < ${tabla.latitudMax} and ${tabla.longitudMin} < ${tabla.longitudMax}`,
    ),
  ],
);

/**
 * Los puntos de cada vista de una instantánea. En la procesada, `id_punto` es el reporte y lleva
 * estado y caducidad; en la base, es el envío y lleva su hora de recepción.
 */
export const evaluacionPuntosInstantanea = pgTable(
  'evaluacion_puntos_instantanea',
  {
    idInstantanea: uuid('id_instantanea')
      .notNull()
      .references(() => evaluacionInstantaneas.id),
    vista: text('vista').notNull(),
    idPunto: uuid('id_punto').notNull(),
    idReporte: uuid('id_reporte').notNull(),
    codigoCategoria: text('codigo_categoria').notNull(),
    publicLocation: geometry('ubicacion_publica', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }).notNull(),
    estado: text('estado'),
    caducaEn: timestamp('caduca_en', { withTimezone: true }),
    recibidoEn: timestamp('recibido_en', { withTimezone: true }),
    fuenteOficial: text('fuente_oficial'),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.idInstantanea, tabla.vista, tabla.idPunto] }),
    check('evaluacion_puntos_vista_check', sql`${tabla.vista} in ('PROCESADA', 'BASE')`),
    check(
      'evaluacion_puntos_campos_check',
      sql`(${tabla.vista} = 'PROCESADA' and ${tabla.estado} in ('ACTIVO', 'CONFIRMADO') and ${tabla.caducaEn} is not null and ${tabla.recibidoEn} is null)
        or (${tabla.vista} = 'BASE' and ${tabla.estado} is null and ${tabla.caducaEn} is null and ${tabla.recibidoEn} is not null)`,
    ),
  ],
);
