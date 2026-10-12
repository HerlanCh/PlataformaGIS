import { sql } from 'drizzle-orm';
import { check, numeric, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Reputación y pesos: entre 0.00 y 5.00, con los dos decimales que maneja el dominio.
const puntaje = (nombre: string) => numeric(nombre, { precision: 3, scale: 2, mode: 'number' });

export const votos = pgTable(
  'votos',
  {
    // Reporte del módulo `reports` y usuario de `identity`: IDs sin clave foránea (ADR-001).
    idReporte: uuid('id_reporte').notNull(),
    idUsuario: uuid('id_usuario').notNull(),
    valor: text('valor').notNull(),
    /** Reputación del votante en el momento de votar. */
    peso: puntaje('peso').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [
    // Un usuario vota una sola vez por reporte.
    primaryKey({ name: 'votos_pkey', columns: [tabla.idReporte, tabla.idUsuario] }),
    check('votos_valor_check', sql`${tabla.valor} in ('CONFIRMACION', 'NEGACION')`),
    check('votos_peso_check', sql`${tabla.peso} between 0 and 5`),
  ],
);

export const reputaciones = pgTable(
  'reputaciones',
  {
    idUsuario: uuid('id_usuario').primaryKey(),
    puntaje: puntaje('puntaje').notNull(),
    ultimaPenalizacionEn: timestamp('ultima_penalizacion_en', { withTimezone: true }),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [check('reputaciones_puntaje_check', sql`${tabla.puntaje} between 0 and 5`)],
);
