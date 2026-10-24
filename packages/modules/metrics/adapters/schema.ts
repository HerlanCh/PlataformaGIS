import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Ciclo de vida de cada reporte para las métricas del piloto (Fase 13). No hay columna para el
 * autor, los votantes ni la ubicación: la tabla no los puede guardar.
 */
export const metricasReportes = pgTable(
  'metricas_reportes',
  {
    // Reporte del módulo `reports`: se guarda el ID sin clave foránea (ADR-001).
    idReporte: uuid('id_reporte').primaryKey(),
    codigoCategoria: text('codigo_categoria').notNull(),
    esOficial: boolean('es_oficial').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull(),
    primeraConfirmacionEn: timestamp('primera_confirmacion_en', { withTimezone: true }),
    confirmadoEn: timestamp('confirmado_en', { withTimezone: true }),
    cierre: text('cierre'),
    cerradoEn: timestamp('cerrado_en', { withTimezone: true }),
  },
  (tabla) => [
    check(
      'metricas_reportes_cierre_check',
      sql`${tabla.cierre} is null or ${tabla.cierre} in ('CADUCIDAD', 'VOTOS', 'MODERACION')`,
    ),
    check(
      'metricas_reportes_cierre_completo_check',
      sql`(${tabla.cierre} is null) = (${tabla.cerradoEn} is null)`,
    ),
    index('metricas_reportes_creado_en_idx').on(tabla.creadoEn),
  ],
);

/**
 * Huellas de quienes reportaron o votaron en el día en curso: HMAC del día y el usuario. Al
 * cerrar el día se reducen a un conteo en `metricas_diarias` y se borran.
 */
export const metricasActividad = pgTable(
  'metricas_actividad',
  {
    dia: date('dia', { mode: 'string' }).notNull(),
    huella: text('huella').notNull(),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.dia, tabla.huella] }),
    check('metricas_actividad_huella_check', sql`${tabla.huella} ~ '^[0-9a-f]{64}$'`),
  ],
);

/** Personas activas por día, ya sin huellas. */
export const metricasDiarias = pgTable(
  'metricas_diarias',
  {
    dia: date('dia', { mode: 'string' }).primaryKey(),
    usuariosActivos: integer('usuarios_activos').notNull(),
  },
  (tabla) => [check('metricas_diarias_usuarios_check', sql`${tabla.usuariosActivos} >= 0`)],
);
