import { randomUUID } from 'node:crypto';
import type { BusDeEventos } from '@gis/event-bus';
import { verificarBaseDeDatos } from '@gis/platform';
import type {
  ConfigApp,
  InterruptoresDeFunciones,
  Registro,
  DefinicionDeModulo,
  Consultable,
} from '@gis/platform';
import Fastify from 'fastify';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';

const CABECERA_CORRELACION = 'x-request-id';

export interface DependenciasApp {
  readonly config: ConfigApp;
  readonly interruptores: InterruptoresDeFunciones;
  readonly registro: Registro;
  readonly db: Consultable;
  readonly bus: BusDeEventos;
  readonly modulos: readonly DefinicionDeModulo[];
}

/**
 * Raíz de composición del servidor HTTP: registra los módulos activos.
 * No contiene lógica de negocio.
 */
export async function construirApp(dependencias: DependenciasApp): Promise<FastifyInstance> {
  const {
    config,
    interruptores: flags,
    registro: logger,
    db,
    bus,
    modulos: modules,
  } = dependencias;

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
    const database = await verificarBaseDeDatos(db);
    if (!database.ok) request.log.error({ err: database.error }, 'base de datos no disponible');

    return reply.code(database.ok ? 200 : 503).send({
      status: database.ok ? 'ok' : 'degraded',
      version: config.version,
      database: database.ok ? 'up' : 'down',
    });
  });

  for (const modulo of modules) {
    if (!flags.estaActivo(modulo.nombre)) {
      logger.info({ modulo: modulo.nombre }, 'módulo apagado por interruptor');
      continue;
    }
    await modulo.registrar(app, bus, config);
    logger.info({ modulo: modulo.nombre }, 'módulo registrado');
  }

  return app;
}
