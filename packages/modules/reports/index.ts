import { fileURLToPath } from 'node:url';
import type { ModuleDefinition } from '@gis/platform';

/** Punto de entrada público del módulo `reports`. Solo lo importa la raíz de composición. */
export const reportsModule: ModuleDefinition = {
  name: 'reports',
  migrations: {
    name: 'reports',
    folder: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  register() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};
