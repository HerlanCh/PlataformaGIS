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
