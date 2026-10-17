import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `reports`. Solo lo importa la raíz de composición. */
export const reportsModulo: DefinicionDeModulo = {
  nombre: 'reports',
  migraciones: {
    nombre: 'reports',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};

// Interfaz pública para la raíz de composición: adaptadores y tipos de lectura.
export { RepositorioCategoriasPg } from './adapters/category-repository.js';
export { RepositorioReportesPostgis } from './adapters/report-repository.js';
export { CATEGORIAS_MVP } from './domain/category.js';
export type { Categoria } from './domain/category.js';
export type { RepositorioDeCategorias, RepositorioDeReportes } from './domain/ports.js';
export type { EstadoReporte } from './domain/report.js';
export type { ReportePublico } from './domain/reporte-publico.js';

// Casos de uso y manejadores de eventos (Fase 5).
export { AplicarDecisionDeVerificacion } from './application/aplicar-decision-de-verificacion.js';
export { AplicarRechazoDeModeracion } from './application/aplicar-rechazo-de-moderacion.js';
export { CaducarReportes, LOTE_DE_CADUCIDAD } from './application/caducar-reportes.js';
export type { DependenciasCaducarReportes } from './application/caducar-reportes.js';
export { CrearReporte, LIMITE_DE_REPORTES } from './application/crear-reporte.js';
export type {
  DependenciasCrearReporte,
  EntradaCrearReporte,
  ResultadoCrearReporte,
  SalidaCrearReporte,
} from './application/crear-reporte.js';
export {
  ListarReportesEnVentana,
  MAX_REPORTES_POR_VENTANA,
} from './application/listar-reportes-en-ventana.js';
export type { EntradaListarReportesEnVentana } from './application/listar-reportes-en-ventana.js';
export type { DependenciasDeTransicion } from './application/aplicar-transicion.js';
export type { UnidadDeTrabajoDeReporte } from './application/ports.js';
export { UnidadDeTrabajoReportePg } from './adapters/report-unit-of-work.js';
export type { ReputacionDelAutor } from './domain/ports.js';
export type { Reporte } from './domain/report.js';
