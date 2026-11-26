import type { Ejecutor } from '@gis/platform';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Exportacion, Fila, NombreDeTabla } from '../domain/exportacion.js';
import type { RepositorioDeExportacion } from '../domain/ports.js';

/**
 * Cada tabla con los nombres de columna del CSV y en un orden estable. Las ubicaciones salen como
 * latitud y longitud (solo hay ubicaciones públicas) y las horas en ISO 8601 UTC.
 */
/** Hora en ISO 8601 UTC con milisegundos, como la escribe `Date.toISOString`. */
const iso = (columna: string) =>
  sql.raw(
    `to_char(${columna} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as ${columna.split('.').pop()}`,
  );

const CONSULTAS: Readonly<Record<NombreDeTabla, SQL>> = {
  envios: sql`select id_envio, tipo, id_reporte, codigo_categoria, st_y(ubicacion_publica) as latitud,
    st_x(ubicacion_publica) as longitud, fuente_oficial, ${iso('recibido_en')}
    from evaluacion_envios order by recibido_en, id_envio`,
  transiciones: sql`select id_evento, id_reporte, estado, ${iso('caduca_en')}, ${iso('ocurrido_en')}
    from evaluacion_transiciones order by ocurrido_en, id_evento`,
  votos: sql`select id_evento, id_reporte, valor, peso, decision, ${iso('ocurrido_en')}
    from evaluacion_votos order by ocurrido_en, id_evento`,
  instantaneas: sql`select id, nombre, ${iso('instante')}, latitud_min, latitud_max, longitud_min,
    longitud_max, ${iso('creada_en')} from evaluacion_instantaneas order by creada_en, nombre`,
  puntos: sql`select id_instantanea, vista, id_punto, id_reporte, codigo_categoria,
    st_y(ubicacion_publica) as latitud, st_x(ubicacion_publica) as longitud, estado,
    ${iso('caduca_en')}, ${iso('recibido_en')}, fuente_oficial
    from evaluacion_puntos_instantanea order by id_instantanea, vista, id_punto`,
  tareas: sql`select t.id as id_tarea, s.codigo_participante, s.secuencia, t.orden, t.vista,
    t.escenario, t.id_instantanea, ${iso('t.iniciada_en')}, ${iso('t.terminada_en')}, t.duracion_ms,
    t.agotada
    from evaluacion_tareas t join evaluacion_sesiones s on s.id = t.id_sesion
    order by s.codigo_participante, t.orden`,
  marcas: sql`select id_tarea, id_punto, ms_desde_inicio from evaluacion_marcas
    order by id_tarea, ms_desde_inicio, id_punto`,
  etiquetas: sql`select evaluador, id_envio, grupo from evaluacion_etiquetas
    order by evaluador, id_envio`,
  claves: sql`select id_instantanea, grupo from evaluacion_claves order by id_instantanea, grupo`,
  verificaciones: sql`select id_reporte, resultado, ${iso('fin_en')}, fuente, detalle_fuente,
    ${iso('registrada_en')} from evaluacion_verificaciones order by id_reporte`,
};

export class RepositorioExportacionPg implements RepositorioDeExportacion {
  constructor(private readonly db: Ejecutor) {}

  async exportar(): Promise<Exportacion> {
    const nombres = Object.keys(CONSULTAS) as NombreDeTabla[];
    const resultados = await Promise.all(nombres.map((n) => this.db.execute(CONSULTAS[n])));
    return Object.fromEntries(
      nombres.map((n, i) => [n, resultados[i]!.rows as unknown as Fila[]]),
    ) as unknown as Exportacion;
  }
}
