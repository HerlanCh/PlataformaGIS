import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `subscriptions`. Solo lo importa la raíz de composición. */
export const subscriptionsModulo: DefinicionDeModulo = {
  nombre: 'subscriptions',
  migraciones: {
    nombre: 'subscriptions',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};

// Interfaz pública para la raíz de composición: adaptador y puerto.
export { RepositorioSuscripcionesPg } from './adapters/subscription-repository.js';
export type { RepositorioDeSuscripciones } from './domain/ports.js';

// Casos de uso y manejador de eventos (Fase 5).
export { EliminarZona } from './application/eliminar-zona.js';
export type { EntradaEliminarZona } from './application/eliminar-zona.js';
export { NotificarSuscriptores } from './application/notificar-suscriptores.js';
export type { DependenciasNotificarSuscriptores } from './application/notificar-suscriptores.js';
export type {
  AvisoDeReporte,
  ConsultaDeAutor,
  EnviadorDeNotificaciones,
} from './application/ports.js';
export { MAX_ZONAS_POR_USUARIO, SuscribirZona } from './application/suscribir-zona.js';
export type {
  DependenciasSuscribirZona,
  EntradaSuscribirZona,
} from './application/suscribir-zona.js';
export type { ZonaSuscrita } from './domain/zone-subscription.js';
