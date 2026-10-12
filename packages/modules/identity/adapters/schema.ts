import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Usuarios anónimos. Sin datos personales: solo el hash del dispositivo y, si existe, Telegram. */
export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey(),
    deviceHash: text('device_hash').notNull().unique(),
    telegramId: text('telegram_id').unique(),
    role: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (tabla) => [check('users_role_check', sql`${tabla.role} in ('CIUDADANO', 'MODERADOR')`)],
);
