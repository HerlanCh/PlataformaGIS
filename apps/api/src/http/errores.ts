import { reportadorNulo } from '@gis/errores-remotos';
import type { ReportadorDeErrores } from '@gis/errores-remotos';
import { esBaseDeDatosNoDisponible } from '@gis/platform';
import { ErrorDeAplicacion, ErrorDeDominio, ErrorLimiteExcedido } from '@gis/shared-kernel';
import type { TipoDeErrorDeAplicacion } from '@gis/shared-kernel';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

/** Falta el token, es inválido o venció: 401. No es una regla de negocio, por eso vive aquí. */
export class ErrorNoAutenticado extends Error {
  constructor(
    readonly codigo: 'TOKEN_AUSENTE' | 'TOKEN_INVALIDO' | 'TOKEN_VENCIDO',
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorNoAutenticado';
  }
}

export const TIPO_DE_CONTENIDO_PROBLEMA = 'application/problem+json';

/** Cuerpo RFC 7807. `codigo` es estable; `instance` es el ID de correlación. */
export interface Problema {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly codigo: string;
  readonly instance: string;
}

const ESTADO_POR_TIPO: Record<TipoDeErrorDeAplicacion, number> = {
  NO_ENCONTRADO: 404,
  PROHIBIDO: 403,
  CONFLICTO: 409,
  VALIDACION_FALLIDA: 422,
  LIMITE_EXCEDIDO: 429,
};

const TITULOS: Record<number, string> = {
  400: 'Solicitud inválida',
  401: 'No autenticado',
  403: 'Prohibido',
  404: 'No encontrado',
  409: 'Conflicto',
  413: 'Cuerpo demasiado grande',
  415: 'Tipo de contenido no admitido',
  422: 'Regla de negocio incumplida',
  429: 'Demasiadas solicitudes',
  500: 'Error interno',
  503: 'Servicio no disponible',
};

/** Segundos que se sugiere esperar cuando la base de datos no responde. */
const REINTENTO_BASE_CAIDA_S = 5;

interface Clasificado {
  readonly status: number;
  readonly codigo: string;
  readonly detail: string;
}

function clasificar(error: unknown): Clasificado {
  if (error instanceof ErrorDeAplicacion) {
    return { status: ESTADO_POR_TIPO[error.tipo], codigo: error.codigo, detail: error.message };
  }
  if (error instanceof ErrorNoAutenticado) {
    return { status: 401, codigo: error.codigo, detail: error.message };
  }
  // Una regla de dominio que ningún caso de uso tradujo sigue siendo una regla de negocio.
  if (error instanceof ErrorDeDominio) {
    return { status: 422, codigo: error.codigo, detail: error.message };
  }
  return clasificarDeInfraestructura(error);
}

/** Errores que no son propios: validación de Fastify, base de datos caída o inesperados. */
function clasificarDeInfraestructura(error: unknown): Clasificado {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return { status: 400, codigo: 'ENTRADA_INVALIDA', detail: error.message };
  }
  const deFastify = error as Partial<FastifyError>;
  const status = deFastify.statusCode;
  if (status !== undefined && status >= 400 && status < 500) {
    return {
      status,
      codigo: deFastify.code ?? 'SOLICITUD_INVALIDA',
      detail: deFastify.message ?? '',
    };
  }
  // Una base caída es temporal: 503 para que el cliente reintente, sin revelar la conexión.
  if (esBaseDeDatosNoDisponible(error)) {
    return {
      status: 503,
      codigo: 'BASE_DE_DATOS_NO_DISPONIBLE',
      detail: 'El servicio no está disponible por un momento; vuelve a intentarlo',
    };
  }
  // Nunca se exponen los detalles de un error inesperado.
  return { status: 500, codigo: 'ERROR_INTERNO', detail: 'Ocurrió un error inesperado' };
}

function problema({ status, codigo, detail }: Clasificado, idSolicitud: string): Problema {
  return {
    type: `https://plataforma-gis.bo/problemas/${codigo.toLowerCase().replaceAll('_', '-')}`,
    title: TITULOS[status] ?? 'Error',
    status,
    detail,
    codigo,
    instance: idSolicitud,
  };
}

/** Traduce cualquier error al formato RFC 7807. */
export const aProblema = (error: unknown, idSolicitud: string): Problema =>
  problema(clasificar(error), idSolicitud);

function responder(reply: FastifyReply, cuerpo: Problema): FastifyReply {
  return reply.code(cuerpo.status).type(TIPO_DE_CONTENIDO_PROBLEMA).send(cuerpo);
}

/**
 * Todos los errores, y las rutas inexistentes, salen como `application/problem+json`. Los 5xx
 * inesperados también van al reportador (GlitchTip), con el patrón de la ruta y no la URL, que
 * puede llevar ids o una ventana del mapa. La base caída (503) solo queda en el log.
 */
export function registrarErrores(
  app: FastifyInstance,
  reportador: ReportadorDeErrores = reportadorNulo,
): void {
  app.setErrorHandler((error, request: FastifyRequest, reply) => {
    const cuerpo = aProblema(error, request.id);
    if (cuerpo.status === 503) request.log.warn({ err: error }, 'base de datos no disponible');
    else if (cuerpo.status >= 500) {
      request.log.error({ err: error }, 'error no controlado');
      reportador.reportar(error, { ruta: `${request.method} ${request.routeOptions.url ?? ''}` });
    }
    if (error instanceof ErrorLimiteExcedido) {
      reply.header('retry-after', String(error.reintentarEnSegundos));
    }
    if (cuerpo.status === 503) reply.header('retry-after', String(REINTENTO_BASE_CAIDA_S));
    return responder(reply, cuerpo);
  });

  app.setNotFoundHandler((request, reply) => {
    const ruta = `${request.method} ${request.url.split('?')[0]}`;
    const detail = `No existe ${ruta}`;
    return responder(
      reply,
      problema({ status: 404, codigo: 'RUTA_NO_ENCONTRADA', detail }, request.id),
    );
  });
}
