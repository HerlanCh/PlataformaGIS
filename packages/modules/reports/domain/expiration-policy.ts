/** Extensiones de vigencia permitidas por reporte (SRS 3.2.4). */
export const MAX_EXTENSIONS = 2;

/** Cada extensión añade esta fracción del TTL original. */
export const EXTENSION_FRACTION = 0.5;

const MS_POR_MINUTO = 60_000;

const sumarMinutos = (fecha: Date, minutos: number): Date =>
  new Date(fecha.getTime() + minutos * MS_POR_MINUTO);

export const ExpirationPolicy = {
  /** Caducidad inicial: la creación más el TTL de la categoría. */
  initialExpiration(createdAt: Date, ttlMinutes: number): Date {
    return sumarMinutos(createdAt, ttlMinutes);
  },

  /** Nueva caducidad tras una extensión: la actual más el 50 % del TTL original. */
  extend(expiresAt: Date, ttlMinutes: number): Date {
    return sumarMinutos(expiresAt, ttlMinutes * EXTENSION_FRACTION);
  },

  /** Un reporte caduca cuando su fecha de caducidad ya pasó; en el instante exacto sigue vigente. */
  isExpired(expiresAt: Date, now: Date): boolean {
    return expiresAt.getTime() < now.getTime();
  },
};
