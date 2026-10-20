import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `open-data`. Solo lo importa la raíz de composición. */
export const openDataModulo: DefinicionDeModulo = {
  nombre: 'open-data',
  migraciones: {
    nombre: 'open-data',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};

// Interfaz pública para la raíz de composición: casos de uso, manejador, adaptador y puertos.
export { RegistrarDatoAbierto, huellaDe } from './application/registrar-dato-abierto.js';
export { CargarHistorico, LOTE_DEL_HISTORICO } from './application/cargar-historico.js';
export {
  aCsv,
  COLUMNAS_CSV,
  ConsultarDatosAbiertos,
} from './application/consultar-datos-abiertos.js';
export { RepositorioDatosAbiertosPg } from './adapters/repositorio-datos-abiertos-pg.js';
export { LICENCIA } from './domain/licencia.js';
export { celdaDe, TAMANO_CELDA_M } from './domain/dato-abierto.js';
export type { ReporteFinalizado } from './domain/dato-abierto.js';
export type {
  ConsultaDeReportesFinalizados,
  FilaPublica,
  RepositorioDeDatosAbiertos,
  Resumen,
} from './domain/ports.js';
