import type { EventBus } from '@gis/event-bus';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from './config.js';
import type { MigrationSet } from './migrations.js';

/**
 * Punto de entrada público de un módulo (`index.ts`). Solo lo llama la raíz
 * de composición, y solo si el módulo está activo.
 */
export interface ModuleDefinition {
  readonly name: string;
  /** Migraciones de las tablas del módulo. Solo se aplican si el módulo está activo. */
  readonly migrations?: MigrationSet;
  register(app: FastifyInstance, bus: EventBus, config: AppConfig): void | Promise<void>;
}
