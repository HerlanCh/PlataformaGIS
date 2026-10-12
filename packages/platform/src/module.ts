import type { BusDeEventos } from '@gis/event-bus';
import type { FastifyInstance } from 'fastify';
import type { ConfigApp } from './config.js';
import type { ConjuntoDeMigraciones } from './migrations.js';

/**
 * Punto de entrada público de un módulo (`index.ts`). Solo lo llama la raíz
 * de composición, y solo si el módulo está activo.
 */
export interface DefinicionDeModulo {
  readonly nombre: string;
  /** Migraciones de las tablas del módulo. Solo se aplican si el módulo está activo. */
  readonly migraciones?: ConjuntoDeMigraciones;
  registrar(app: FastifyInstance, bus: BusDeEventos, config: ConfigApp): void | Promise<void>;
}
