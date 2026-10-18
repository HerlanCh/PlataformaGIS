import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `notifications`. Solo lo importa la raíz de composición. */
export const notificationsModulo: DefinicionDeModulo = {
  nombre: 'notifications',
  migraciones: {
    nombre: 'notifications',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};

// Interfaz pública para la raíz de composición: adaptadores y puertos.
export { EmisorWebPush } from './adapters/emisor-web-push.js';
export type { ClavesVapid, EnviarNotificacion } from './adapters/emisor-web-push.js';
export { RepositorioSuscripcionesPushPg } from './adapters/push-repository.js';
export type { RepositorioDeSuscripcionesPush } from './domain/ports.js';
export type { SuscripcionPush } from './domain/suscripcion-push.js';

// Casos de uso (Fase 8).
export { EliminarSuscripcionPush } from './application/eliminar-suscripcion-push.js';
export type { EntradaEliminarSuscripcionPush } from './application/eliminar-suscripcion-push.js';
export { EnviarAvisoPush } from './application/enviar-aviso-push.js';
export type {
  DependenciasEnviarAvisoPush,
  ResultadoDeAviso,
} from './application/enviar-aviso-push.js';
export { ErrorSuscripcionVencida } from './application/ports.js';
export type { ContenidoDeAviso, EmisorPush } from './application/ports.js';
export { RegistrarSuscripcionPush } from './application/registrar-suscripcion-push.js';
export type {
  DependenciasRegistrarSuscripcionPush,
  EntradaRegistrarSuscripcionPush,
} from './application/registrar-suscripcion-push.js';
