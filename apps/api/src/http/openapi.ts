import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

/** Versión del contrato `/v1`: cambia con el contrato, no con cada despliegue. */
export const VERSION_DEL_CONTRATO = '1.0.0';

/**
 * Valida y serializa con los esquemas Zod de `packages/contracts` y genera desde ellos el
 * documento OpenAPI, publicado en `/docs` (Swagger UI) y `/docs/json`.
 */
export async function registrarOpenApi(app: FastifyInstance): Promise<void> {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Plataforma GIS de alerta temprana — API',
        description:
          'Reportes georreferenciados de incidentes urbanos en La Paz y El Alto. ' +
          'Los errores siguen RFC 7807 (`application/problem+json`).',
        version: VERSION_DEL_CONTRATO,
      },
      servers: [],
      components: {
        securitySchemes: {
          bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: '/docs', staticCSP: true });
}
