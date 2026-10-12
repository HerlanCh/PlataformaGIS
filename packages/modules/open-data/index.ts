import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `open-data`. Solo lo importa la raíz de composición. */
export const openDataModulo: DefinicionDeModulo = {
  nombre: 'open-data',
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};
