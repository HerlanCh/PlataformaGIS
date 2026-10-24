import type { ActividadDiaria, Cierre, RegistroDeReporte } from '../domain/metricas.js';
import type { RepositorioDeMetricas } from '../domain/ports.js';

/** Repositorio en memoria con las mismas reglas que el de PostgreSQL. */
export class MetricasEnMemoria implements RepositorioDeMetricas {
  readonly reportes = new Map<string, RegistroDeReporte>();
  readonly huellas = new Map<string, Set<string>>();
  readonly diarias = new Map<string, number>();

  registrarCreacion(registro: RegistroDeReporte): Promise<void> {
    if (!this.reportes.has(registro.idReporte)) this.reportes.set(registro.idReporte, registro);
    return Promise.resolve();
  }

  marcarPrimeraConfirmacion(idReporte: string, en: Date): Promise<void> {
    return this.cambiar(idReporte, (r) =>
      r.primeraConfirmacionEn ? r : { ...r, primeraConfirmacionEn: en },
    );
  }

  marcarConfirmado(idReporte: string, en: Date): Promise<void> {
    return this.cambiar(idReporte, (r) => (r.confirmadoEn ? r : { ...r, confirmadoEn: en }));
  }

  marcarCierre(idReporte: string, cierre: Cierre, en: Date): Promise<void> {
    return this.cambiar(idReporte, (r) => (r.cierre ? r : { ...r, cierre, cerradoEn: en }));
  }

  buscarRegistros(desde: Date, hasta: Date): Promise<readonly RegistroDeReporte[]> {
    return Promise.resolve(
      [...this.reportes.values()].filter((r) => r.creadoEn >= desde && r.creadoEn < hasta),
    );
  }

  registrarActividad(dia: string, huella: string): Promise<void> {
    this.huellas.set(dia, (this.huellas.get(dia) ?? new Set()).add(huella));
    return Promise.resolve();
  }

  consolidarAntesDe(dia: string): Promise<void> {
    for (const [d, huellas] of this.huellas) {
      if (d < dia) {
        this.diarias.set(d, (this.diarias.get(d) ?? 0) + huellas.size);
        this.huellas.delete(d);
      }
    }
    return Promise.resolve();
  }

  actividadEntre(diaDesde: string, diaHasta: string): Promise<readonly ActividadDiaria[]> {
    const porDia = new Map(this.diarias);
    for (const [d, huellas] of this.huellas) porDia.set(d, (porDia.get(d) ?? 0) + huellas.size);
    return Promise.resolve(
      [...porDia]
        .filter(([d]) => d >= diaDesde && d <= diaHasta)
        .map(([dia, usuariosActivos]) => ({ dia, usuariosActivos })),
    );
  }

  private cambiar(
    idReporte: string,
    cambio: (r: RegistroDeReporte) => RegistroDeReporte,
  ): Promise<void> {
    const actual = this.reportes.get(idReporte);
    if (actual) this.reportes.set(idReporte, cambio(actual));
    return Promise.resolve();
  }
}
