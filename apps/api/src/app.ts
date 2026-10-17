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
import type { CasosDeUso } from './composicion/casos-de-uso.js';
import { registrarErrores } from './http/errores.js';
import { registrarOpenApi } from './http/openapi.js';
import { rutasV1 } from './http/rutas/v1.js';
import { registrarSeguridad } from './http/seguridad.js';
import type { ServicioDeTokens } from './http/tokens.js';

const CABECERA_CORRELACION = 'x-request-id';

/** Tamaño máximo del cuerpo de una solicitud: los reportes y votos son pequeños. */
const LIMITE_DE_CUERPO = 16 * 1024;

/** Lo que necesita la API REST `/v1`. */
export interface DependenciasApi {
  readonly casos: CasosDeUso;
  readonly tokens: ServicioDeTokens;
  /** Solicitudes por minuto y por IP. */
  readonly limitePorMinuto: number;
}

export interface DependenciasApp {
  readonly config: ConfigApp;
  readonly interruptores: InterruptoresDeFunciones;
  readonly registro: Registro;
  readonly db: Consultable;
  readonly bus: BusDeEventos;
  readonly modulos: readonly DefinicionDeModulo[];
  readonly api: DependenciasApi;
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
    api,
  } = dependencias;

  // Se tipa con la interfaz de Fastify para que los módulos reciban un FastifyInstance estándar.
  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({
    loggerInstance,
    // ID de correlación: se respeta el que envía el cliente o se genera uno.
    requestIdHeader: CABECERA_CORRELACION,
    genReqId: () => randomUUID(),
    bodyLimit: LIMITE_DE_CUERPO,
  });

  await registrarOpenApi(app);
  await registrarSeguridad(app, {
    origenCors: config.origenCors,
    limitePorMinuto: api.limitePorMinuto,
  });
  registrarErrores(app);

  app.addHook('onSend', async (request, reply) => {
    reply.header(CABECERA_CORRELACION, request.id);
  });

  app.get('/health', { schema: { hide: true } }, async (request, reply) => {
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

  await app.register(rutasV1({ casos: api.casos, tokens: api.tokens }), { prefix: '/v1' });
  return app;
}
