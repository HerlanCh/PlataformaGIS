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

// Interfaz pública para la raíz de composición: casos de uso, manejador, adaptadores y puertos.
export { RechazarReporte } from './application/rechazar-reporte.js';
export type {
  DependenciasRechazarReporte,
  EntradaRechazarReporte,
} from './application/rechazar-reporte.js';
export { MantenerReporte } from './application/mantener-reporte.js';
export type {
  DependenciasMantenerReporte,
  EntradaMantenerReporte,
} from './application/mantener-reporte.js';
export {
  LIMITE_DE_LA_COLA,
  ListarColaDeModeracion,
} from './application/listar-cola-de-moderacion.js';
export type { ElementoDeCola, EntradaListarCola } from './application/listar-cola-de-moderacion.js';
export { ActualizarColaDeModeracion } from './application/actualizar-cola-de-moderacion.js';
export type { UnidadDeTrabajoDeModeracion } from './application/ports.js';
export { RepositorioColaPg } from './adapters/repositorio-cola-pg.js';
export { UnidadDeTrabajoModeracionPg } from './adapters/unidad-de-trabajo-moderacion.js';
export type {
  ConsultaDeReporte,
  DetalleDeReporte,
  EstadoDeReporte,
  RepositorioDeCola,
} from './domain/ports.js';
