/** Código de PostgreSQL para una violación de clave única o primaria. */
const CLAVE_DUPLICADA = '23505';

interface ErrorPg {
  readonly code?: unknown;
  readonly constraint?: unknown;
}

/**
 * `true` si el error (o su causa: Drizzle envuelve el de `pg`) es una clave duplicada; si se
 * indica la restricción, solo cuando es esa.
 */
export function esClaveDuplicada(error: unknown, restriccion?: string): boolean {
  const causa = error instanceof Error ? error.cause : undefined;
  return [error, causa].some((candidato) => {
    const pg = candidato as ErrorPg | undefined;
    return (
      pg?.code === CLAVE_DUPLICADA && (restriccion === undefined || pg.constraint === restriccion)
    );
  });
}

const CODIGOS_DE_CONEXION = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']);
// SQLSTATE: clase 08 (excepción de conexión), 57P01 a 57P03 (apagado o arranque del servidor)
// y 53300 (demasiadas conexiones).
const SQLSTATE_DE_CONEXION = /^(08|57P0[1-3]|53300)/;
// Errores del pool de `pg` que no traen código.
const MENSAJES_DE_CONEXION = /timeout exceeded when trying to connect|connection terminated/i;

function esDeConexion(error: Error & ErrorPg): boolean {
  const codigo = typeof error.code === 'string' ? error.code : '';
  return (
    CODIGOS_DE_CONEXION.has(codigo) ||
    SQLSTATE_DE_CONEXION.test(codigo) ||
    MENSAJES_DE_CONEXION.test(error.message)
  );
}

/**
 * `true` si el error, o alguna de sus causas, indica que la base de datos no responde: un estado
 * temporal, no un defecto.
 */
export function esBaseDeDatosNoDisponible(error: unknown): boolean {
  for (let actual = error; actual instanceof Error; actual = actual.cause) {
    if (esDeConexion(actual)) return true;
  }
  return false;
}
