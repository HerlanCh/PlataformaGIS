const ANFITRIONES_LOCALES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Devuelve `DATABASE_URL` solo si apunta a la máquina local. Los scripts que borran o fuerzan
 * datos nunca deben tocar una base real.
 */
export function urlDeBaseLocal(url: string | undefined, proposito: string): string {
  if (!url) throw new Error('Falta DATABASE_URL');
  const { hostname } = new URL(url);
  if (!ANFITRIONES_LOCALES.has(hostname)) {
    throw new Error(`${proposito} solo corre en una base local, no en "${hostname}"`);
  }
  return url;
}
