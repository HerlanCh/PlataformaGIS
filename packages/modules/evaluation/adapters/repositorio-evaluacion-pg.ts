import type { Ejecutor } from '@gis/platform';
import { and, count, inArray, lte, max, sql } from 'drizzle-orm';
import type { RepositorioDeEvaluacion } from '../domain/ports.js';
import type {
  EstadoDelRegistro,
  Envio,
  EstadoRegistrado,
  TipoDeEnvio,
  Transicion,
  VotoRegistrado,
} from '../domain/registro.js';
import { VENTANA_BASE_MS } from '../domain/vistas.js';
import type { Caja, RegistroParaVistas } from '../domain/vistas.js';
import { evaluacionEnvios, evaluacionTransiciones, evaluacionVotos } from './schema.js';

const envios = evaluacionEnvios;
const transiciones = evaluacionTransiciones;

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
            select 1 from ${transiciones}
            where ${transiciones.idReporte} = ${envios.idReporte}
              and ${transiciones.ocurridoEn} <= ${instante}
              and ${transiciones.caducaEn} >= ${instante}))`,
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
}
