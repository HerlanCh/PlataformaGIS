import { http } from '@gis/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Evaluacion } from '../../composicion/casos-de-uso.js';
import { exigirToken, identidadDe, SEGURIDAD_BEARER } from '../autenticacion.js';
import { ERRORES } from './comun.js';

/**
 * Instrumentos de evaluación (ADR-007): exigen token y el caso de uso exige el rol `MODERADOR`.
 * Con `evaluation` apagado no se registran (404).
 */
export function registrarRutasDeEvaluacion(
  app: Parameters<FastifyPluginAsyncZod>[0],
  evaluacion: Evaluacion,
  conToken: { preHandler: ReturnType<typeof exigirToken> },
): void {
  app.get(
    '/evaluacion/estado',
    {
      ...conToken,
      schema: {
        tags: ['evaluación'],
        summary: 'Estado del registro de la evaluación (ADR-007, rol MODERADOR)',
        description:
          'Cuántos envíos lleva registrados y cuándo llegó el último. La prueba de humo lo usa ' +
          'para comprobar que el módulo registra.',
        security: SEGURIDAD_BEARER,
        response: { 200: http.esquemaEstadoDelRegistro, ...ERRORES },
      },
    },
    async (request) => {
      const estado = await evaluacion.estado.ejecutar({ rolActor: identidadDe(request).rol });
      return {
        enviosRegistrados: estado.enviosRegistrados,
        ultimoEnvioEn: estado.ultimoEnvioEn?.toISOString() ?? null,
      };
    },
  );
}
