/**
 * Exportación del registro y de las herramientas (ADR-007) para el análisis fuera de línea: un CSV
 * por tabla, con las columnas fijas de `COLUMNAS_EXPORTADAS`. Es el contrato con `pnpm
 * piloto:analizar` y `pnpm piloto:sensibilidad`. Sin datos personales: las tablas no los tienen.
 */

export type Valor = string | number | boolean | Date | null;

export type Fila = Readonly<Record<string, Valor>>;

export const COLUMNAS_EXPORTADAS = {
  envios: [
    'id_envio',
    'tipo',
    'id_reporte',
    'codigo_categoria',
    'latitud',
    'longitud',
    'fuente_oficial',
    'recibido_en',
  ],
  transiciones: ['id_evento', 'id_reporte', 'estado', 'caduca_en', 'ocurrido_en'],
  votos: ['id_evento', 'id_reporte', 'valor', 'peso', 'decision', 'ocurrido_en'],
  instantaneas: [
    'id',
    'nombre',
    'instante',
    'latitud_min',
    'latitud_max',
    'longitud_min',
    'longitud_max',
    'creada_en',
  ],
  puntos: [
    'id_instantanea',
    'vista',
    'id_punto',
    'id_reporte',
    'codigo_categoria',
    'latitud',
    'longitud',
    'estado',
    'caduca_en',
    'recibido_en',
    'fuente_oficial',
  ],
  tareas: [
    'id_tarea',
    'codigo_participante',
    'secuencia',
    'orden',
    'vista',
    'escenario',
    'id_instantanea',
    'iniciada_en',
    'terminada_en',
    'duracion_ms',
    'agotada',
  ],
  marcas: ['id_tarea', 'id_punto', 'ms_desde_inicio'],
  etiquetas: ['evaluador', 'id_envio', 'grupo'],
  claves: ['id_instantanea', 'grupo'],
  verificaciones: [
    'id_reporte',
    'resultado',
    'fin_en',
    'fuente',
    'detalle_fuente',
    'registrada_en',
  ],
} as const satisfies Record<string, readonly string[]>;

export type NombreDeTabla = keyof typeof COLUMNAS_EXPORTADAS;

export type Exportacion = Readonly<Record<NombreDeTabla, readonly Fila[]>>;

const texto = (valor: Valor | undefined): string => {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  return String(valor);
};

/** Un campo entre comillas si lleva coma, comillas o salto de línea (RFC 4180). */
const campo = (valor: Valor | undefined): string => {
  const t = texto(valor);
  return /[",\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
};

/** Las filas de una tabla en CSV, con su encabezado y sus columnas en el orden fijo. */
export function aCsv(tabla: NombreDeTabla, filas: readonly Fila[]): string {
  const columnas = COLUMNAS_EXPORTADAS[tabla];
  const lineas = filas.map((f) => columnas.map((c) => campo(f[c])).join(','));
  return `${[columnas.join(','), ...lineas].join('\n')}\n`;
}
