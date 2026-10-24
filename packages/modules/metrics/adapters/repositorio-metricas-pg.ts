import type { Ejecutor } from '@gis/platform';
import { and, asc, between, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { ActividadDiaria, Cierre, RegistroDeReporte } from '../domain/metricas.js';
import type { RepositorioDeMetricas } from '../domain/ports.js';
import { metricasActividad, metricasDiarias, metricasReportes as reportes } from './schema.js';

export class RepositorioMetricasPg implements RepositorioDeMetricas {
  constructor(private readonly db: Ejecutor) {}

  async registrarCreacion(registro: RegistroDeReporte): Promise<void> {
    await this.db
      .insert(reportes)
      .values({ ...registro })
      .onConflictDoNothing({ target: reportes.idReporte });
  }

  async marcarPrimeraConfirmacion(idReporte: string, en: Date): Promise<void> {
    await this.db
      .update(reportes)
      .set({ primeraConfirmacionEn: en })
      .where(and(eq(reportes.idReporte, idReporte), isNull(reportes.primeraConfirmacionEn)));
  }

  async marcarConfirmado(idReporte: string, en: Date): Promise<void> {
    await this.db
      .update(reportes)
      .set({ confirmadoEn: en })
      .where(and(eq(reportes.idReporte, idReporte), isNull(reportes.confirmadoEn)));
  }

  async marcarCierre(idReporte: string, cierre: Cierre, en: Date): Promise<void> {
    await this.db
      .update(reportes)
      .set({ cierre, cerradoEn: en })
      .where(and(eq(reportes.idReporte, idReporte), isNull(reportes.cierre)));
  }

  async buscarRegistros(desde: Date, hasta: Date): Promise<readonly RegistroDeReporte[]> {
    const filas = await this.db
      .select()
      .from(reportes)
      .where(and(gte(reportes.creadoEn, desde), lt(reportes.creadoEn, hasta)))
      .orderBy(asc(reportes.creadoEn), asc(reportes.idReporte));
    return filas.map((f) => ({ ...f, cierre: f.cierre as Cierre | null }));
  }

  async registrarActividad(dia: string, huella: string): Promise<void> {
    await this.db.insert(metricasActividad).values({ dia, huella }).onConflictDoNothing();
  }

  async consolidarAntesDe(dia: string): Promise<void> {
    // Una sola sentencia: el conteo y el borrado de las huellas ocurren juntos o no ocurren.
    await this.db.execute(sql`
      with cerradas as (
        delete from ${metricasActividad} where ${metricasActividad.dia} < ${dia}
        returning ${metricasActividad.dia}
      )
      insert into ${metricasDiarias} (dia, usuarios_activos)
      select dia, count(*)::int from cerradas group by dia
      on conflict (dia) do update
        set usuarios_activos = ${metricasDiarias.usuariosActivos} + excluded.usuarios_activos`);
  }

  async actividadEntre(diaDesde: string, diaHasta: string): Promise<readonly ActividadDiaria[]> {
    const [diarias, enCurso] = await Promise.all([
      this.db
        .select({ dia: metricasDiarias.dia, usuariosActivos: metricasDiarias.usuariosActivos })
        .from(metricasDiarias)
        .where(between(metricasDiarias.dia, diaDesde, diaHasta)),
      this.db
        .select({ dia: metricasActividad.dia, usuariosActivos: sql<number>`count(*)::int` })
        .from(metricasActividad)
        .where(between(metricasActividad.dia, diaDesde, diaHasta))
        .groupBy(metricasActividad.dia),
    ]);
    const porDia = new Map<string, number>();
    for (const { dia, usuariosActivos } of [...diarias, ...enCurso]) {
      porDia.set(dia, (porDia.get(dia) ?? 0) + usuariosActivos);
    }
    return [...porDia]
      .map(([dia, usuariosActivos]) => ({ dia, usuariosActivos }))
      .sort((a, b) => a.dia.localeCompare(b.dia));
  }
}
