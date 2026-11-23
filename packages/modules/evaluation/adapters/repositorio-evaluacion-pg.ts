import type { Ejecutor } from '@gis/platform';
import { and, asc, count, eq, gte, inArray, isNull, lt, lte, max, sql } from 'drizzle-orm';
import type { EnvioEtiquetable } from '../domain/etiquetado.js';
import type { RepositorioDeEvaluacion } from '../domain/ports.js';
import type {
  EstadoDelRegistro,
  Envio,
  EstadoRegistrado,
  TipoDeEnvio,
  Transicion,
  VotoRegistrado,
} from '../domain/registro.js';
import type { ReporteVerificable } from '../domain/verificacion.js';
import { VENTANA_BASE_MS } from '../domain/vistas.js';
import type { Caja, RegistroParaVistas } from '../domain/vistas.js';
import { evaluacionEnvios, evaluacionTransiciones, evaluacionVotos } from './schema.js';

const envios = evaluacionEnvios;
const transiciones = evaluacionTransiciones;

const latitud = sql<number>`st_y(${envios.publicLocation})`;
const longitud = sql<number>`st_x(${envios.publicLocation})`;

/**
 * Subconsultas correlacionadas con el envío. Las columnas van con su tabla escrita a mano: dentro de
 * un `select` de una sola tabla Drizzle las escribe sin ella, y `id_reporte = id_reporte` se
 * resolvería contra la tabla interna (siempre verdadero).
 */
const ID_REPORTE_DEL_ENVIO = sql.raw('"evaluacion_envios"."id_reporte"');

/** El reporte del envío tuvo en algún momento esta transición. */
const tuvo = (estado: string) =>
  sql<boolean>`exists (select 1 from evaluacion_transiciones t
    where t.id_reporte = ${ID_REPORTE_DEL_ENVIO} and t.estado = ${estado})`;

/** Envíos de la comunidad (sin fuente oficial) recibidos en el periodo y no rechazados. */
const deLaComunidadEn = (desde: Date, hasta: Date) =>
  and(
    isNull(envios.fuenteOficial),
    gte(envios.recibidoEn, desde),
    lt(envios.recibidoEn, hasta),
    sql`not ${tuvo('RECHAZADO')}`,
  );

/** `&&` con la caja usa el índice GiST de `ubicacion_publica`; un punto en el borde queda dentro. */
export const dentroDeLaCaja = (columna: typeof envios.publicLocation, caja: Caja) =>
  sql`${columna} && st_makeenvelope(${caja.longitudMin}, ${caja.latitudMin}, ${caja.longitudMax}, ${caja.latitudMax}, 4326)`;

/** Registro de la evaluación en PostgreSQL. Cada escritura ignora lo que ya estaba. */
export class RepositorioEvaluacionPg implements RepositorioDeEvaluacion {
  constructor(private readonly db: Ejecutor) {}

  async registrarEnvio(envio: Envio): Promise<void> {
    const { publicLocation, ...resto } = envio;
    await this.db
      .insert(evaluacionEnvios)
      .values({
        ...resto,
        publicLocation: { x: publicLocation.longitud, y: publicLocation.latitud },
      })
      .onConflictDoNothing({ target: evaluacionEnvios.idEnvio });
  }

  async registrarTransicion(transicion: Transicion): Promise<void> {
    await this.db
      .insert(evaluacionTransiciones)
      .values({ ...transicion })
      .onConflictDoNothing({ target: evaluacionTransiciones.idEvento });
  }

  async registrarVoto(voto: VotoRegistrado): Promise<void> {
    await this.db
      .insert(evaluacionVotos)
      .values({ ...voto })
      .onConflictDoNothing({ target: evaluacionVotos.idEvento });
  }

  async estado(): Promise<EstadoDelRegistro> {
    const [fila] = await this.db
      .select({ enviosRegistrados: count(), ultimoEnvioEn: max(evaluacionEnvios.recibidoEn) })
      .from(evaluacionEnvios);
    return {
      enviosRegistrados: fila?.enviosRegistrados ?? 0,
      ultimoEnvioEn: fila?.ultimoEnvioEn ?? null,
    };
  }

  /**
   * Envíos de la caja recibidos hasta el instante que caben en alguna vista: los de las últimas
   * 24 h y los de un reporte con alguna caducidad que llegue al instante (superconjunto de los
   * vigentes; el dominio decide). Luego, las transiciones de esos reportes hasta el instante.
   */
  async buscarParaVistas(instante: Date, caja: Caja): Promise<RegistroParaVistas> {
    const desde = new Date(instante.getTime() - VENTANA_BASE_MS);
    const filas = await this.db
      .select({
        idEnvio: envios.idEnvio,
        tipo: envios.tipo,
        idReporte: envios.idReporte,
        codigoCategoria: envios.codigoCategoria,
        latitud: sql<number>`st_y(${envios.publicLocation})`,
        longitud: sql<number>`st_x(${envios.publicLocation})`,
        fuenteOficial: envios.fuenteOficial,
        recibidoEn: envios.recibidoEn,
      })
      .from(envios)
      .where(
        and(
          dentroDeLaCaja(envios.publicLocation, caja),
          lte(envios.recibidoEn, instante),
          sql`(${envios.recibidoEn} > ${desde} or exists (
            select 1 from evaluacion_transiciones t
            where t.id_reporte = ${ID_REPORTE_DEL_ENVIO}
              and t.ocurrido_en <= ${instante}
              and t.caduca_en >= ${instante}))`,
        ),
      );
    const idsDeReportes = [...new Set(filas.map((f) => f.idReporte))];
    const cambios =
      idsDeReportes.length === 0
        ? []
        : await this.db
            .select()
            .from(transiciones)
            .where(
              and(
                inArray(transiciones.idReporte, idsDeReportes),
                lte(transiciones.ocurridoEn, instante),
              ),
            );
    return {
      envios: filas.map(({ latitud, longitud, tipo, ...resto }) => ({
        ...resto,
        tipo: tipo as TipoDeEnvio,
        publicLocation: { latitud, longitud },
      })),
      transiciones: cambios.map((t) => ({ ...t, estado: t.estado as EstadoRegistrado })),
    };
  }

  async buscarEnviosEtiquetables(desde: Date, hasta: Date): Promise<readonly EnvioEtiquetable[]> {
    const filas = await this.db
      .select({
        idEnvio: envios.idEnvio,
        codigoCategoria: envios.codigoCategoria,
        latitud,
        longitud,
        recibidoEn: envios.recibidoEn,
      })
      .from(envios)
      .where(deLaComunidadEn(desde, hasta))
      .orderBy(asc(envios.recibidoEn), asc(envios.idEnvio));
    return filas.map(({ latitud: lat, longitud: lon, ...resto }) => ({
      ...resto,
      publicLocation: { latitud: lat, longitud: lon },
    }));
  }

  async buscarReportesVerificables(
    desde: Date,
    hasta: Date,
  ): Promise<readonly ReporteVerificable[]> {
    const filas = await this.db
      .select({
        idReporte: envios.idReporte,
        codigoCategoria: envios.codigoCategoria,
        latitud,
        longitud,
        creadoEn: envios.recibidoEn,
        confirmado: tuvo('CONFIRMADO'),
      })
      .from(envios)
      .where(and(eq(envios.tipo, 'CREADO'), deLaComunidadEn(desde, hasta)))
      .orderBy(asc(envios.recibidoEn), asc(envios.idReporte));
    return filas.map(({ latitud: lat, longitud: lon, ...resto }) => ({
      ...resto,
      publicLocation: { latitud: lat, longitud: lon },
    }));
  }
}
