import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  geometry,
  index,
  integer,
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  unique,
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

/** Sesión de la tarea cronometrada de un participante, con su código anónimo (`P07`). */
export const evaluacionSesiones = pgTable(
  'evaluacion_sesiones',
  {
    id: uuid('id').primaryKey(),
    codigoParticipante: text('codigo_participante').notNull().unique(),
    secuencia: integer('secuencia').notNull(),
    creadaEn: timestamp('creada_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check('evaluacion_sesiones_codigo_check', sql`${tabla.codigoParticipante} ~ '^P[0-9]{2,3}$'`),
    check('evaluacion_sesiones_secuencia_check', sql`${tabla.secuencia} between 1 and 4`),
  ],
);

/** Las dos tareas de cada sesión: vista, escenario e instantánea, y su inicio y cierre. */
export const evaluacionTareas = pgTable(
  'evaluacion_tareas',
  {
    id: uuid('id').primaryKey(),
    idSesion: uuid('id_sesion')
      .notNull()
      .references(() => evaluacionSesiones.id),
    orden: integer('orden').notNull(),
    vista: text('vista').notNull(),
    escenario: text('escenario').notNull(),
    idInstantanea: uuid('id_instantanea')
      .notNull()
      .references(() => evaluacionInstantaneas.id),
    iniciadaEn: timestamp('iniciada_en', { withTimezone: true }),
    terminadaEn: timestamp('terminada_en', { withTimezone: true }),
    duracionMs: integer('duracion_ms'),
    agotada: boolean('agotada'),
  },
  (tabla) => [
    unique('evaluacion_tareas_sesion_orden_unique').on(tabla.idSesion, tabla.orden),
    check('evaluacion_tareas_orden_check', sql`${tabla.orden} in (1, 2)`),
    check('evaluacion_tareas_vista_check', sql`${tabla.vista} in ('PROCESADA', 'BASE')`),
    check('evaluacion_tareas_escenario_check', sql`${tabla.escenario} in ('E1', 'E2')`),
    check(
      'evaluacion_tareas_cierre_check',
      sql`(${tabla.terminadaEn} is null) = (${tabla.duracionMs} is null)
        and (${tabla.terminadaEn} is null) = (${tabla.agotada} is null)
        and (${tabla.terminadaEn} is null or ${tabla.iniciadaEn} is not null)`,
    ),
    check('evaluacion_tareas_duracion_check', sql`${tabla.duracionMs} between 0 and 180000`),
  ],
);

/** Los puntos que el participante marcó, con el momento de la primera marca. */
export const evaluacionMarcas = pgTable(
  'evaluacion_marcas',
  {
    idTarea: uuid('id_tarea')
      .notNull()
      .references(() => evaluacionTareas.id),
    idPunto: uuid('id_punto').notNull(),
    msDesdeInicio: integer('ms_desde_inicio').notNull(),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.idTarea, tabla.idPunto] }),
    check('evaluacion_marcas_ms_check', sql`${tabla.msDesdeInicio} between 0 and 180000`),
  ],
);

/** Grupo (incidente real) al que cada evaluador asignó un envío. Sin id de usuario. */
export const evaluacionEtiquetas = pgTable(
  'evaluacion_etiquetas',
  {
    evaluador: text('evaluador').notNull(),
    idEnvio: uuid('id_envio')
      .notNull()
      .references(() => evaluacionEnvios.idEnvio),
    grupo: text('grupo').notNull(),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.evaluador, tabla.idEnvio] }),
    check(
      'evaluacion_etiquetas_evaluador_check',
      sql`${tabla.evaluador} in ('A', 'B', 'CONSENSO')`,
    ),
    check('evaluacion_etiquetas_grupo_check', sql`char_length(${tabla.grupo}) between 1 and 40`),
  ],
);

/** Referencia independiente de veracidad y hora de fin de un reporte. */
export const evaluacionVerificaciones = pgTable(
  'evaluacion_verificaciones',
  {
    // Reporte del módulo `reports`: se guarda el ID sin clave foránea (ADR-001).
    idReporte: uuid('id_reporte').primaryKey(),
    resultado: text('resultado').notNull(),
    finEn: timestamp('fin_en', { withTimezone: true }),
    fuente: text('fuente').notNull(),
    detalleFuente: text('detalle_fuente'),
    registradaEn: timestamp('registrada_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    check(
      'evaluacion_verificaciones_resultado_check',
      sql`${tabla.resultado} in ('REAL', 'FALSO', 'NO_VERIFICABLE')`,
    ),
    check(
      'evaluacion_verificaciones_fuente_check',
      sql`${tabla.fuente} in ('CAMPO', 'SECUNDARIA')`,
    ),
    check(
      'evaluacion_verificaciones_fin_check',
      sql`${tabla.finEn} is null or ${tabla.resultado} = 'REAL'`,
    ),
    check(
      'evaluacion_verificaciones_detalle_check',
      sql`${tabla.detalleFuente} is null or char_length(${tabla.detalleFuente}) <= 200`,
    ),
  ],
);
