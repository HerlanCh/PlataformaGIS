import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `classifier`. Solo lo importa la raíz de composición. */
export const classifierModulo: DefinicionDeModulo = {
  nombre: 'classifier',
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};
