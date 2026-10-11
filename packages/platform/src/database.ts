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

/** Pool acotado: los planes gratuitos limitan las conexiones (RSK-02). */
export function createPool(databaseUrl: string, max = 5): Pool {
  return new pg.Pool({ connectionString: databaseUrl, max, connectionTimeoutMillis: 5000 });
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
