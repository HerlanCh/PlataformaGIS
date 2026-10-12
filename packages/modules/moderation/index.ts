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
