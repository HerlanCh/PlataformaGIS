import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { ErrorNoAutenticado } from './errores.js';
import type { Identidad, ServicioDeTokens } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Usuario autenticado. Solo existe en las rutas que exigen token. */
    identidad?: Identidad;
  }
}

const PREFIJO = 'Bearer ';

/** `preHandler` que exige un token válido en `Authorization: Bearer` y deja la identidad. */
export const exigirToken =
  (tokens: ServicioDeTokens): preHandlerAsyncHookHandler =>
  async (request) => {
    const cabecera = request.headers.authorization;
    if (!cabecera?.startsWith(PREFIJO)) {
      throw new ErrorNoAutenticado('TOKEN_AUSENTE', 'Falta la cabecera Authorization: Bearer');
    }
    request.identidad = await tokens.verificar(cabecera.slice(PREFIJO.length));
  };

/** Identidad de una ruta protegida por `exigirToken`. */
export function identidadDe(request: FastifyRequest): Identidad {
  if (!request.identidad) {
    throw new ErrorNoAutenticado('TOKEN_AUSENTE', 'La ruta exige un token');
  }
  return request.identidad;
}

/** Esquema de seguridad que declaran en OpenAPI las rutas protegidas. */
export const SEGURIDAD_BEARER = [{ bearer: [] }];
