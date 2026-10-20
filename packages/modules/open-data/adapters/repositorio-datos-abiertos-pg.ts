import type { Ejecutor } from '@gis/platform';
import { asc, sql } from 'drizzle-orm';
import type { DatoAbierto, EstadoFinal } from '../domain/dato-abierto.js';
import type { FilaPublica, RepositorioDeDatosAbiertos, Resumen } from '../domain/ports.js';
import { datosAbiertosReportes as tabla } from './schema.js';

/** La hora del día se cuenta en la de La Paz, que es la que reconocen sus habitantes. */
const ZONA_HORARIA = 'America/La_Paz';

export class RepositorioDatosAbiertosPg implements RepositorioDeDatosAbiertos {
  constructor(private readonly db: Ejecutor) {}

  async guardar(dato: DatoAbierto): Promise<boolean> {
    const insertadas = await this.db
      .insert(tabla)
      .values({
        huella: dato.huella,
        codigoCategoria: dato.codigoCategoria,
        celdaLatitud: dato.celda.latitud,
        celdaLongitud: dato.celda.longitud,
        hora: dato.hora,
        estadoFinal: dato.estadoFinal,
        fueConfirmado: dato.fueConfirmado,
      })
      .onConflictDoNothing({ target: tabla.huella })
      .returning({ huella: tabla.huella });
    return insertadas.length > 0;
  }

  async listar(): Promise<readonly FilaPublica[]> {
    // Se eligen las columnas públicas una por una: la huella nunca sale.
    const filas = await this.db
      .select({
        codigoCategoria: tabla.codigoCategoria,
        latitud: tabla.celdaLatitud,
        longitud: tabla.celdaLongitud,
        hora: tabla.hora,
        estadoFinal: tabla.estadoFinal,
        fueConfirmado: tabla.fueConfirmado,
      })
      .from(tabla)
      .orderBy(asc(tabla.hora), asc(tabla.codigoCategoria));
    return filas.map((f) => ({
      codigoCategoria: f.codigoCategoria,
      celda: { latitud: f.latitud, longitud: f.longitud },
      hora: f.hora,
      estadoFinal: f.estadoFinal as EstadoFinal,
      fueConfirmado: f.fueConfirmado,
    }));
  }

  async resumir(): Promise<Resumen> {
    const [totales] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        confirmados: sql<number>`(count(*) filter (where ${tabla.fueConfirmado}))::int`,
        desde: sql<Date | null>`min(${tabla.hora})`,
        hasta: sql<Date | null>`max(${tabla.hora})`,
      })
      .from(tabla);
    const porCategoria = await this.db
      .select({ codigoCategoria: tabla.codigoCategoria, cantidad: sql<number>`count(*)::int` })
      .from(tabla)
      .groupBy(tabla.codigoCategoria)
      .orderBy(sql`count(*) desc`, asc(tabla.codigoCategoria));
    // La zona va como literal: con un parámetro, el `group by` no reconoce la misma expresión.
    const horaLocal = sql<number>`extract(hour from ${tabla.hora} at time zone ${sql.raw(`'${ZONA_HORARIA}'`)})::int`;
    const porHora = await this.db
      .select({ hora: horaLocal, cantidad: sql<number>`count(*)::int` })
      .from(tabla)
      .groupBy(horaLocal);
    const porHoraDelDia = Array.from({ length: 24 }, () => 0);
    for (const { hora, cantidad } of porHora) porHoraDelDia[hora] = cantidad;
    return {
      total: totales?.total ?? 0,
      confirmados: totales?.confirmados ?? 0,
      porCategoria,
      porHoraDelDia,
      desde: totales?.desde ? new Date(totales.desde) : null,
      hasta: totales?.hasta ? new Date(totales.hasta) : null,
    };
  }
}
