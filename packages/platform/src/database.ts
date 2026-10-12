import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export type Pool = pg.Pool;

/** Lo mínimo que necesita una comprobación de salud; facilita los dobles de prueba. */
export interface Consultable {
  query(sql: string): Promise<unknown>;
}

export interface SaludBaseDeDatos {
  readonly ok: boolean;
  readonly error?: string;
}

export type EscuchaDeErrorInactivo = (error: Error) => void;

/** Base de datos con el constructor de consultas de Drizzle. */
export type Db = NodePgDatabase;

/** Transacción abierta con `db.transaction(...)`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Lo que recibe un repositorio: la base de datos o una transacción en curso.
 * Así el mismo adaptador sirve dentro y fuera de una unidad de trabajo.
 */
export type Ejecutor = Db | Tx;

/**
 * Pool acotado: los planes gratuitos limitan las conexiones (RSK-02).
 * Si la base de datos se cae, las conexiones inactivas emiten `error`; sin un oyente
 * ese evento tumbaría el proceso. Aquí solo se notifica: el pool se recupera solo.
 */
export function crearPool(
  urlBaseDeDatos: string,
  alErrorInactivo: EscuchaDeErrorInactivo = () => {},
  max = 5,
): Pool {
  const pool = new pg.Pool({
    connectionString: urlBaseDeDatos,
    max,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', alErrorInactivo);
  return pool;
}

export function crearDb(pool: Pool): Db {
  return drizzle(pool);
}

/** Nunca lanza: una base de datos caída es un estado que se informa, no un fallo del proceso. */
export async function verificarBaseDeDatos(db: Consultable): Promise<SaludBaseDeDatos> {
  try {
    await db.query('SELECT 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
