import { fileURLToPath } from 'node:url';
import type { ModuleDefinition } from '@gis/platform';

/** Punto de entrada público del módulo `verification`. Solo lo importa la raíz de composición. */
export const verificationModule: ModuleDefinition = {
  name: 'verification',
  migrations: {
    name: 'verification',
    folder: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  register() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};
