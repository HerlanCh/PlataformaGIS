import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ErrorLimiteExcedido } from '@gis/shared-kernel';
import type { FastifyInstance } from 'fastify';

export interface OpcionesDeSeguridad {
  /** Único origen web admitido: la PWA. */
  readonly origenCors: string;
  /** Solicitudes por minuto y por IP. */
  readonly limitePorMinuto: number;
}

/**
 * Protecciones comunes a toda la API: cabeceras seguras, CORS restringido y un límite de
 * solicitudes por IP. Los límites por usuario (reportes y votos) los aplican los casos de uso.
 */
export async function registrarSeguridad(
  app: FastifyInstance,
  opciones: OpcionesDeSeguridad,
): Promise<void> {
  await app.register(helmet, {
    // Swagger UI en `/docs` sirve su propio CSP (`staticCSP`); el resto de la API solo devuelve JSON.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cors, {
    origin: opciones.origenCors,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-request-id'],
    exposedHeaders: ['x-request-id', 'retry-after'],
    maxAge: 600,
  });
  await app.register(rateLimit, {
    max: opciones.limitePorMinuto,
    timeWindow: '1 minute',
    // Se lanza como error de aplicación: sale como RFC 7807 con `Retry-After`.
    errorResponseBuilder: (_request, contexto) =>
      new ErrorLimiteExcedido(Math.max(1, Math.ceil(contexto.ttl / 1000))),
  });
}
