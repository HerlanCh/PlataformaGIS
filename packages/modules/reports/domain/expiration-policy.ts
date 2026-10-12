/** Extensiones de vigencia permitidas por reporte (SRS 3.2.4). */
export const MAX_EXTENSIONES = 2;

/** Cada extensión añade esta fracción del TTL original. */
export const FRACCION_DE_EXTENSION = 0.5;

const MS_POR_MINUTO = 60_000;

const sumarMinutos = (fecha: Date, minutos: number): Date =>
  new Date(fecha.getTime() + minutos * MS_POR_MINUTO);

export const PoliticaDeCaducidad = {
  /** Caducidad inicial: la creación más el TTL de la categoría. */
  caducidadInicial(creadoEn: Date, ttlMinutos: number): Date {
    return sumarMinutos(creadoEn, ttlMinutos);
  },

  /** Nueva caducidad tras una extensión: la actual más el 50 % del TTL original. */
  extender(caducaEn: Date, ttlMinutos: number): Date {
    return sumarMinutos(caducaEn, ttlMinutos * FRACCION_DE_EXTENSION);
  },

  /** Un reporte caduca cuando su fecha de caducidad ya pasó; en el instante exacto sigue vigente. */
  haCaducado(caducaEn: Date, ahora: Date): boolean {
    return caducaEn.getTime() < ahora.getTime();
  },
};
