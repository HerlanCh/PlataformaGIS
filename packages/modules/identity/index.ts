import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `identity`. Solo lo importa la raíz de composición. */
export const identityModulo: DefinicionDeModulo = {
  nombre: 'identity',
  migraciones: {
    nombre: 'identity',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};
