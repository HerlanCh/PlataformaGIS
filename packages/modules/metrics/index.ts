import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `metrics`. Solo lo importa la raíz de composición. */
export const metricsModulo: DefinicionDeModulo = {
  nombre: 'metrics',
  migraciones: {
    nombre: 'metrics',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};

// Interfaz pública para la raíz de composición: casos de uso, manejador y adaptador.
export { RegistrarEventoDeReporte } from './application/registrar-evento-de-reporte.js';
export { RegistrarActividad, huellaDelDia } from './application/registrar-actividad.js';
export {
  aCsv,
  COLUMNAS_CSV,
  ConsultarMetricas,
  MAX_DIAS_DE_CONSULTA,
} from './application/consultar-metricas.js';
export type {
  EntradaConsultarMetricas,
  PeriodoConMetricas,
} from './application/consultar-metricas.js';
export { RepositorioMetricasPg } from './adapters/repositorio-metricas-pg.js';
export { diaEnLaPaz } from './domain/metricas.js';
export type { RegistroDeReporte, ResumenDeMetricas } from './domain/metricas.js';
export type { RepositorioDeMetricas } from './domain/ports.js';
