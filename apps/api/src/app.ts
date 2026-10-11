import { randomUUID } from 'node:crypto';
import type { EventBus } from '@gis/event-bus';
import { checkDatabase } from '@gis/platform';
import type { AppConfig, FeatureFlags, Logger, ModuleDefinition, Queryable } from '@gis/platform';
import Fastify from 'fastify';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';

const CABECERA_CORRELACION = 'x-request-id';

export interface AppDependencies {
  readonly config: AppConfig;
  readonly flags: FeatureFlags;
  readonly logger: Logger;
  readonly db: Queryable;
  readonly bus: EventBus;
  readonly modules: readonly ModuleDefinition[];
}

/**
 * Raíz de composición del servidor HTTP: registra los módulos activos.
 * No contiene lógica de negocio.
 */
export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const { config, flags, logger, db, bus, modules } = deps;

  // Se tipa con la interfaz de Fastify para que los módulos reciban un FastifyInstance estándar.
  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({
    loggerInstance,
    // ID de correlación: se respeta el que envía el cliente o se genera uno.
    requestIdHeader: CABECERA_CORRELACION,
    genReqId: () => randomUUID(),
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header(CABECERA_CORRELACION, request.id);
  });

  app.get('/health', async (request, reply) => {
    const database = await checkDatabase(db);
    if (!database.ok) request.log.error({ err: database.error }, 'base de datos no disponible');

    return reply.code(database.ok ? 200 : 503).send({
      status: database.ok ? 'ok' : 'degraded',
      version: config.version,
      database: database.ok ? 'up' : 'down',
    });
  });

  for (const modulo of modules) {
    if (!flags.isEnabled(modulo.name)) {
      logger.info({ modulo: modulo.name }, 'módulo apagado por interruptor');
      continue;
    }
    await modulo.register(app, bus, config);
    logger.info({ modulo: modulo.name }, 'módulo registrado');
  }

  return app;
}
