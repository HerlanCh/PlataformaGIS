import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `reports`. Solo lo importa la raíz de composición. */
export const reportsModulo: DefinicionDeModulo = {
  nombre: 'reports',
  migraciones: {
    nombre: 'reports',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};
