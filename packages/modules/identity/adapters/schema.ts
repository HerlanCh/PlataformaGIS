import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Usuarios anónimos. Sin datos personales: solo el hash del dispositivo y, si existe, Telegram. */
export const users = pgTable(
  'usuarios',
  {
    id: uuid().primaryKey(),
    deviceHash: text('hash_dispositivo').notNull().unique(),
    telegramId: text('id_telegram').unique(),
    role: text('rol').notNull(),
    createdAt: timestamp('creado_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [check('usuarios_rol_check', sql`${tabla.role} in ('CIUDADANO', 'MODERADOR')`)],
);
