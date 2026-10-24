import type { ActividadDiaria, Cierre, RegistroDeReporte } from './metricas.js';

export interface RepositorioDeMetricas {
  /** Alta del reporte. Si ya existe, no hace nada. */
  registrarCreacion(registro: RegistroDeReporte): Promise<void>;
  /** Solo la primera: las siguientes no cambian nada. */
  marcarPrimeraConfirmacion(idReporte: string, en: Date): Promise<void>;
  marcarConfirmado(idReporte: string, en: Date): Promise<void>;
  /** Solo el primer cierre cuenta. */
  marcarCierre(idReporte: string, cierre: Cierre, en: Date): Promise<void>;
  /** Reportes creados en `[desde, hasta)`. */
  buscarRegistros(desde: Date, hasta: Date): Promise<readonly RegistroDeReporte[]>;

  /** Anota la huella de quien actuó ese día. Repetirla no cuenta dos veces. */
  registrarActividad(dia: string, huella: string): Promise<void>;
  /** Reduce a un conteo cada día anterior a `dia` y borra sus huellas. */
  consolidarAntesDe(dia: string): Promise<void>;
  /** Personas activas por día en `[diaDesde, diaHasta]`, consolidados o no. */
  actividadEntre(diaDesde: string, diaHasta: string): Promise<readonly ActividadDiaria[]>;
}
