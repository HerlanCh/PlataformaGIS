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
