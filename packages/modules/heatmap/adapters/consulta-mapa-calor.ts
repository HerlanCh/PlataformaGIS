import type { Ejecutor } from '@gis/platform';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  cuadriculaPara,
  UMBRAL_ANONIMATO,
  validarConsultaDeCalor,
} from '../domain/consulta-de-calor.js';
import type {
  CeldaDeCalor,
  ConsultaDeCalor,
  ConsultaDeMapaDeCalor,
} from '../domain/consulta-de-calor.js';

interface FilaDeCalor extends Record<string, unknown> {
  readonly latitud: number;
  readonly longitud: number;
  readonly cantidad: number;
}

/**
 * Mapa de calor sobre la tabla `reportes`, que pertenece al módulo `reports` (ADR-003).
 * Es una lectura acotada: solo `SELECT`, solo columnas públicas (`ubicacion_publica`, `estado`,
 * `codigo_categoria`, `creado_en`) y nunca la ubicación real ni el autor. No importa código de
 * `reports`: conoce el nombre de la tabla y nada más.
 */
export class ConsultaMapaCalorPg implements ConsultaDeMapaDeCalor {
  constructor(private readonly db: Ejecutor) {}

  async agregar(consulta: ConsultaDeCalor): Promise<readonly CeldaDeCalor[]> {
    validarConsultaDeCalor(consulta);
    const { desde, hasta, categorias } = consulta;
    const { paso, centros, envolvente } = cuadriculaPara(consulta.caja, consulta.tamanoCeldaM);
    // Margen para comparar centros de celda en coma flotante: un cuarto de celda.
    const margenLatitud = paso.latitud / 4;
    const margenLongitud = paso.longitud / 4;

    const porCategoria: SQL =
      categorias.length > 0
        ? sql`and codigo_categoria in (${sql.join(
            categorias.map((categoria) => sql`${categoria}`),
            sql`, `,
          )})`
        : sql``;

    // `ST_SnapToGrid` lleva cada punto al centro de su celda. La envolvente (celdas enteras) usa
    // el índice GiST; el filtro por centro descarta las celdas vecinas que solo la rozan.
    const { rows } = await this.db.execute<FilaDeCalor>(sql`
      select st_y(celda) as latitud, st_x(celda) as longitud, count(*)::int as cantidad
      from (
        select st_snaptogrid(ubicacion_publica, 0, 0, ${paso.longitud}, ${paso.latitud}) as celda
        from reportes
        where ubicacion_publica && st_makeenvelope(${envolvente.longitudMin}, ${envolvente.latitudMin}, ${envolvente.longitudMax}, ${envolvente.latitudMax}, 4326)
          and creado_en between ${desde.toISOString()} and ${hasta.toISOString()}
          and estado <> 'RECHAZADO'
          ${porCategoria}
      ) agrupados
      where st_y(celda) between ${centros.latitudMin - margenLatitud} and ${centros.latitudMax + margenLatitud}
        and st_x(celda) between ${centros.longitudMin - margenLongitud} and ${centros.longitudMax + margenLongitud}
      group by celda
      having count(*) >= ${UMBRAL_ANONIMATO}
      order by cantidad desc, latitud, longitud
    `);

    return rows.map((fila) => ({
      latitud: Number(fila.latitud),
      longitud: Number(fila.longitud),
      cantidad: Number(fila.cantidad),
    }));
  }
}
