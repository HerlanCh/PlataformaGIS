import type { ModuleDefinition } from '@gis/platform';

/** Punto de entrada público del módulo `open-data`. Solo lo importa la raíz de composición. */
export const openDataModule: ModuleDefinition = {
  name: 'open-data',
  register() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};
