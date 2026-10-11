import pg from 'pg';

export type Pool = pg.Pool;

/** Lo mínimo que necesita una comprobación de salud; facilita los dobles de prueba. */
export interface Queryable {
  query(sql: string): Promise<unknown>;
}

export interface DatabaseHealth {
  readonly ok: boolean;
  readonly error?: string;
}

export type IdleErrorListener = (error: Error) => void;

/**
 * Pool acotado: los planes gratuitos limitan las conexiones (RSK-02).
 * Si la base de datos se cae, las conexiones inactivas emiten `error`; sin un oyente
 * ese evento tumbaría el proceso. Aquí solo se notifica: el pool se recupera solo.
 */
export function createPool(
  databaseUrl: string,
  onIdleError: IdleErrorListener = () => {},
  max = 5,
): Pool {
  const pool = new pg.Pool({ connectionString: databaseUrl, max, connectionTimeoutMillis: 5000 });
  pool.on('error', onIdleError);
  return pool;
}

/** Nunca lanza: una base de datos caída es un estado que se informa, no un fallo del proceso. */
export async function checkDatabase(db: Queryable): Promise<DatabaseHealth> {
  try {
    await db.query('SELECT 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
