import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `classifier`. Solo lo importa la raíz de composición. */
export const classifierModulo: DefinicionDeModulo = {
  nombre: 'classifier',
  migraciones: {
    nombre: 'classifier',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};

// Interfaz pública para la raíz de composición: manejador, adaptadores y puertos (Fase 10).
export { ClasificarReporte } from './application/clasificar-reporte.js';
export type { DependenciasClasificarReporte } from './application/clasificar-reporte.js';
export type {
  ConsultaParaClasificar,
  UnidadDeTrabajoDeClasificacion,
} from './application/ports.js';
export { ClasificadorConRespaldo } from './adapters/clasificador-con-respaldo.js';
export type { OpcionesDeRespaldo } from './adapters/clasificador-con-respaldo.js';
export { ClasificadorPorReglas } from './adapters/clasificador-por-reglas.js';
export { UnidadDeTrabajoClasificacionPg } from './adapters/unidad-de-trabajo-clasificacion.js';
export type {
  Clasificacion,
  Clasificador,
  DatosParaClasificar,
  MotivoDeSospecha,
} from './domain/clasificacion.js';
export { UMBRAL_DE_FRECUENCIA } from './domain/reglas-de-clasificacion.js';
