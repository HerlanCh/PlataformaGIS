import { http } from '@gis/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { CasosDeUso } from '../../composicion/casos-de-uso.js';
import { exigirToken, identidadDe, SEGURIDAD_BEARER } from '../autenticacion.js';
import type { ServicioDeTokens } from '../tokens.js';
import { aReporteHttp, aZonaHttp, ERRORES } from './comun.js';

export interface DependenciasRutas {
  readonly casos: CasosDeUso;
  readonly tokens: ServicioDeTokens;
}

/**
 * Rutas `/v1`. Cada una es delgada: valida con el contrato, llama al caso de uso y traduce el
 * resultado. Las de un módulo opcional apagado no se registran (404).
 */
export const rutasV1 =
  ({ casos, tokens }: DependenciasRutas): FastifyPluginAsyncZod =>
  async (app) => {
    const conToken = { preHandler: exigirToken(tokens) };

    app.post(
      '/dispositivos',
      {
        schema: {
          tags: ['dispositivos'],
          summary: 'Registra el dispositivo y entrega su token',
          description: 'Idempotente por dispositivo: repetirla renueva el token.',
          body: http.esquemaRegistroDispositivo,
          response: { 200: http.esquemaCredencial, ...ERRORES },
        },
      },
      async (request) => {
        const usuario = await casos.registrarDispositivo.ejecutar(request.body);
        const { token, expiraEn } = await tokens.firmar(usuario);
        return { ...usuario, token, expiraEn: expiraEn.toISOString() };
      },
    );

    app.post(
      '/reportes',
      {
        ...conToken,
        schema: {
          tags: ['reportes'],
          summary: 'Crea un reporte (HU-01)',
          description:
            'Idempotente por la cabecera Idempotency-Key (HU-05). Si ya hay uno igual cerca, ' +
            'responde DUPLICADO y el envío cuenta como confirmación.',
          security: SEGURIDAD_BEARER,
          headers: http.esquemaCabecerasNuevoReporte,
          body: http.esquemaNuevoReporte,
          response: { 200: http.esquemaReporteCreado, 201: http.esquemaReporteCreado, ...ERRORES },
        },
      },
      async (request, reply) => {
        const salida = await casos.crearReporte.ejecutar({
          ...request.body,
          idAutor: identidadDe(request).idUsuario,
          idempotencyKey: request.headers['idempotency-key'],
        });
        return reply
          .code(salida.resultado === 'CREADO' ? 201 : 200)
          .send({ resultado: salida.resultado, reporte: aReporteHttp(salida.reporte) });
      },
    );

    app.get(
      '/reportes',
      {
        schema: {
          tags: ['reportes'],
          summary: 'Reportes vigentes de una ventana del mapa (HU-02)',
          querystring: http.esquemaConsultaReportes,
          response: { 200: http.esquemaListaDeReportes, ...ERRORES },
        },
      },
      async (request) => {
        const reportes = await casos.listarReportes.ejecutar({
          ...request.query.bbox,
          categorias: request.query.categorias ?? [],
        });
        return { reportes: reportes.map(aReporteHttp) };
      },
    );

    for (const [ruta, caso, resumen] of [
      ['confirmar', casos.confirmarReporte, '¿Sigue ahí? → Sí (HU-03)'],
      ['negar', casos.negarReporte, '¿Sigue ahí? → No (HU-03)'],
    ] as const) {
      app.post(
        `/reportes/:id/${ruta}`,
        {
          ...conToken,
          schema: {
            tags: ['votos'],
            summary: resumen,
            security: SEGURIDAD_BEARER,
            params: http.esquemaParametroId,
            body: http.esquemaVoto,
            response: { 200: http.esquemaVotoRegistrado, ...ERRORES },
          },
        },
        async (request) =>
          caso.ejecutar({
            ...request.body,
            idReporte: request.params.id,
            idVotante: identidadDe(request).idUsuario,
          }),
      );
    }

    const { obtenerMapaDeCalor, suscribirZona, eliminarZona, rechazarReporte } = casos;

    if (obtenerMapaDeCalor) {
      app.get(
        '/mapa-calor',
        {
          schema: {
            tags: ['mapa de calor'],
            summary: 'Celdas con 3 o más reportes en un rango de fechas (HU-06)',
            querystring: http.esquemaConsultaMapaCalor,
            response: { 200: http.esquemaMapaDeCalor, ...ERRORES },
          },
        },
        async (request) => {
          const { bbox, tamanoCelda, categorias, desde, hasta } = request.query;
          const celdas = await obtenerMapaDeCalor.ejecutar({
            ...bbox,
            desde,
            hasta,
            categorias: categorias ?? [],
            ...(tamanoCelda === undefined ? {} : { tamanoCeldaM: tamanoCelda }),
          });
          return { celdas: [...celdas] };
        },
      );
    }

    if (suscribirZona && eliminarZona) {
      app.post(
        '/suscripciones',
        {
          ...conToken,
          schema: {
            tags: ['suscripciones'],
            summary: 'Suscribe una zona de interés (HU-07)',
            security: SEGURIDAD_BEARER,
            body: http.esquemaNuevaZona,
            response: { 201: http.esquemaZona, ...ERRORES },
          },
        },
        async (request, reply) => {
          const zona = await suscribirZona.ejecutar({
            ...request.body,
            idUsuario: identidadDe(request).idUsuario,
          });
          return reply.code(201).send(aZonaHttp(zona));
        },
      );

      app.delete(
        '/suscripciones/:id',
        {
          ...conToken,
          schema: {
            tags: ['suscripciones'],
            summary: 'Elimina una zona propia (HU-07)',
            security: SEGURIDAD_BEARER,
            params: http.esquemaParametroId,
            response: { 204: http.esquemaSinContenido, ...ERRORES },
          },
        },
        async (request, reply) => {
          await eliminarZona.ejecutar({
            idZona: request.params.id,
            idUsuario: identidadDe(request).idUsuario,
          });
          return reply.code(204).send();
        },
      );
    }

    if (rechazarReporte) {
      app.post(
        '/moderacion/reportes/:id/rechazar',
        {
          ...conToken,
          schema: {
            tags: ['moderación'],
            summary: 'Rechaza un reporte (HU-12, rol MODERADOR)',
            description: 'El cambio de estado se aplica de forma asíncrona, al procesar el evento.',
            security: SEGURIDAD_BEARER,
            params: http.esquemaParametroId,
            body: http.esquemaRechazo,
            response: { 202: http.esquemaSinContenido, ...ERRORES },
          },
        },
        async (request, reply) => {
          const { idUsuario, rol } = identidadDe(request);
          await rechazarReporte.ejecutar({
            idReporte: request.params.id,
            idModerador: idUsuario,
            rolActor: rol,
            motivo: request.body.motivo,
          });
          return reply.code(202).send();
        },
      );
    }
  };
