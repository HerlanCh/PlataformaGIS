import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const suscripcionesPush = pgTable(
  'suscripciones_push',
  {
    id: uuid().primaryKey(),
    // Usuario del módulo `identity`: se guarda el ID sin clave foránea (ADR-001).
    idUsuario: uuid('id_usuario').notNull(),
    /** URL del servicio push del navegador: identifica al dispositivo. */
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [index('suscripciones_push_usuario_idx').on(tabla.idUsuario)],
);
