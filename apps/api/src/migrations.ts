import { platformMigrations } from '@gis/platform';
import type { FeatureFlags, MigrationSet, ModuleDefinition } from '@gis/platform';

/**
 * Conjuntos de migraciones a aplicar, en orden: primero la plataforma y luego cada
 * módulo activo. Un módulo apagado por su interruptor no crea sus tablas.
 */
export function migrationSets(
  flags: FeatureFlags,
  modules: readonly ModuleDefinition[],
): MigrationSet[] {
  const deModulos = modules
    .filter((modulo) => flags.isEnabled(modulo.name))
    .flatMap((modulo) => (modulo.migrations ? [modulo.migrations] : []));
  return [platformMigrations, ...deModulos];
}
