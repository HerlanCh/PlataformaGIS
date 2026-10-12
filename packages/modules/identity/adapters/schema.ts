import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Usuarios anónimos. Sin datos personales: solo el hash del dispositivo y, si existe, Telegram. */
export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid().primaryKey(),
    hashDispositivo: text('hash_dispositivo').notNull().unique(),
    idTelegram: text('id_telegram').unique(),
    rol: text('rol').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull(),
  },
  (tabla) => [check('usuarios_rol_check', sql`${tabla.rol} in ('CIUDADANO', 'MODERADOR')`)],
);
