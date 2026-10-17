import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `moderation`. Solo lo importa la raíz de composición. */
export const moderationModulo: DefinicionDeModulo = {
  nombre: 'moderation',
  migraciones: {
    nombre: 'moderation',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};

// Interfaz pública para la raíz de composición: caso de uso, adaptador y puertos.
export { RechazarReporte } from './application/rechazar-reporte.js';
export type {
  DependenciasRechazarReporte,
  EntradaRechazarReporte,
} from './application/rechazar-reporte.js';
export type { UnidadDeTrabajoDeModeracion } from './application/ports.js';
export { UnidadDeTrabajoModeracionPg } from './adapters/unidad-de-trabajo-moderacion.js';
export type { ConsultaDeReporte, EstadoDeReporte } from './domain/ports.js';
