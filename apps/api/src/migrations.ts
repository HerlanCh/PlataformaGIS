import { migracionesDePlataforma } from '@gis/platform';
import type {
  InterruptoresDeFunciones,
  ConjuntoDeMigraciones,
  DefinicionDeModulo,
} from '@gis/platform';

/**
 * Conjuntos de migraciones a aplicar, en orden: primero la plataforma y luego cada
 * módulo activo. Un módulo apagado por su interruptor no crea sus tablas.
 */
export function conjuntosDeMigraciones(
  interruptores: InterruptoresDeFunciones,
  modulos: readonly DefinicionDeModulo[],
): ConjuntoDeMigraciones[] {
  const deModulos = modulos
    .filter((modulo) => interruptores.estaActivo(modulo.nombre))
    .flatMap((modulo) => (modulo.migraciones ? [modulo.migraciones] : []));
  return [migracionesDePlataforma, ...deModulos];
}
