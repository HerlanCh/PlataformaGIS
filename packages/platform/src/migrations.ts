import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Db } from './database.js';

/** Esquema de PostgreSQL donde vive el historial de migraciones de todos los conjuntos. */
const ESQUEMA_HISTORIAL = 'drizzle';

/**
 * Migraciones de un dueño (la plataforma o un módulo), con su propio historial.
 * Un módulo apagado no ejecuta las suyas y borrarlo no afecta a los demás.
 */
export interface MigrationSet {
  /** Nombre del dueño: `platform`, `reports`, `open-data`… */
  readonly name: string;
  /** Carpeta generada por Drizzle Kit: archivos `.sql` y `meta/_journal.json`. */
  readonly folder: string;
}

interface EntradaDelDiario {
  readonly tag: string;
  readonly when: number;
}

/** Migraciones de la plataforma: extensión PostGIS y outbox. Se aplican siempre primero. */
export const platformMigrations: MigrationSet = {
  name: 'platform',
  folder: fileURLToPath(new URL('../migrations', import.meta.url)),
};

export const migrationsTable = (set: MigrationSet): string =>
  `migrations_${set.name.replaceAll('-', '_')}`;

/** Aplica las migraciones pendientes del conjunto. Repetirlo no tiene efecto. */
export async function migrateUp(db: Db, set: MigrationSet): Promise<void> {
  await migrate(db, {
    migrationsFolder: set.folder,
    migrationsSchema: ESQUEMA_HISTORIAL,
    migrationsTable: migrationsTable(set),
  });
}

/** Aplica, en orden, las migraciones pendientes de varios conjuntos. */
export async function migrateAll(db: Db, sets: readonly MigrationSet[]): Promise<void> {
  for (const set of sets) await migrateUp(db, set);
}

/**
 * Revierte la última migración aplicada del conjunto con su archivo `<tag>.down.sql`
 * (Drizzle no genera reversas: se escriben a mano junto a cada migración).
 * Devuelve el nombre de la migración revertida, o `null` si no había ninguna aplicada.
 */
export async function revertLast(db: Db, set: MigrationSet): Promise<string | null> {
  const historial = sql.raw(`"${ESQUEMA_HISTORIAL}"."${migrationsTable(set)}"`);
  const { rows } = await db.execute<{ created_at: string }>(
    sql`select created_at from ${historial} order by created_at desc limit 1`,
  );
  const ultima = rows[0];
  if (!ultima) return null;

  const diario = JSON.parse(
    await readFile(path.join(set.folder, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: EntradaDelDiario[] };
  const entrada = diario.entries.find((e) => e.when === Number(ultima.created_at));
  if (!entrada) {
    throw new Error(`La última migración aplicada de "${set.name}" no está en su diario`);
  }

  const reversa = await readFile(path.join(set.folder, `${entrada.tag}.down.sql`), 'utf8');
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(reversa));
    await tx.execute(sql`delete from ${historial} where created_at = ${entrada.when}`);
  });
  return entrada.tag;
}
