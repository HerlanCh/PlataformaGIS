import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Datos abiertos anonimizados (HU-11): una fila por reporte terminado. No hay columna para el
 * autor, el punto, la descripción ni el ID: la tabla no puede guardarlos (ADR-005).
 */
export const datosAbiertosReportes = pgTable(
  'datos_abiertos_reportes',
  {
    /** SHA-256 del ID del reporte: evita duplicados y nunca se publica. */
    huella: text('huella').primaryKey(),
    codigoCategoria: text('codigo_categoria').notNull(),
    /** Centro de la celda de 500 m, nunca el punto del reporte. */
    celdaLatitud: doublePrecision('celda_latitud').notNull(),
    celdaLongitud: doublePrecision('celda_longitud').notNull(),
    /** Hora de creación truncada a la hora. */
    hora: timestamp('hora', { withTimezone: true }).notNull(),
    estadoFinal: text('estado_final').notNull(),
    fueConfirmado: boolean('fue_confirmado').notNull(),
  },
  (tabla) => [
    check(
      'datos_abiertos_estado_final_check',
      sql`${tabla.estadoFinal} in ('RESUELTO', 'CADUCADO', 'RECHAZADO')`,
    ),
    check(
      'datos_abiertos_hora_truncada_check',
      // En UTC, para no depender de la zona horaria de la sesión.
      sql`date_trunc('hour', ${tabla.hora} at time zone 'UTC') = ${tabla.hora} at time zone 'UTC'`,
    ),
    check('datos_abiertos_huella_check', sql`${tabla.huella} ~ '^[0-9a-f]{64}$'`),
    index('datos_abiertos_hora_idx').on(tabla.hora),
  ],
);
