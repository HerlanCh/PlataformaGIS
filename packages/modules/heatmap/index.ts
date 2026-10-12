import type { DefinicionDeModulo } from '@gis/platform';

export { ConsultaMapaCalorPg } from './adapters/consulta-mapa-calor.js';
export {
  ErrorConsultaDeCalorInvalida,
  TAMANO_CELDA_M,
  UMBRAL_ANONIMATO,
} from './domain/consulta-de-calor.js';
export type {
  CeldaDeCalor,
  ConsultaDeCalor,
  ConsultaDeMapaDeCalor,
} from './domain/consulta-de-calor.js';

/** Punto de entrada público del módulo `heatmap`. Solo lo importa la raíz de composición. */
export const heatmapModulo: DefinicionDeModulo = {
  nombre: 'heatmap',
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};
