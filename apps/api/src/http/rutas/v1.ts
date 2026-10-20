import { http } from '@gis/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AvisosPush, CasosDeUso } from '../../composicion/casos-de-uso.js';
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

    app.patch(
      '/reportes/:id/descripcion',
      {
        ...conToken,
        schema: {
          tags: ['reportes'],
          summary: 'El autor describe su reporte (HU-10)',
          description:
            'Una sola vez y con el reporte vigente. La descripción es privada: no aparece en ' +
            'ninguna respuesta pública y solo la revisan el clasificador y los moderadores.',
          security: SEGURIDAD_BEARER,
          params: http.esquemaParametroId,
          body: http.esquemaDescripcion,
          response: { 204: http.esquemaSinContenido, ...ERRORES },
        },
      },
      async (request, reply) => {
        await casos.agregarDescripcion.ejecutar({
          idReporte: request.params.id,
          idAutor: identidadDe(request).idUsuario,
          descripcion: request.body.descripcion,
        });
        return reply.code(204).send();
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

    const { obtenerMapaDeCalor, suscribirZona, eliminarZona, listarZonas, rechazarReporte } = casos;
    if (casos.avisosPush) registrarRutasDeAvisos(app, casos.avisosPush, conToken);

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

    if (suscribirZona && eliminarZona && listarZonas) {
      app.get(
        '/suscripciones',
        {
          ...conToken,
          schema: {
            tags: ['suscripciones'],
            summary: 'Zonas suscritas propias (HU-07)',
            security: SEGURIDAD_BEARER,
            response: { 200: http.esquemaListaDeZonas, ...ERRORES },
          },
        },
        async (request) => {
          const zonas = await listarZonas.ejecutar({ idUsuario: identidadDe(request).idUsuario });
          return { zonas: zonas.map(aZonaHttp) };
        },
      );

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

/** Avisos Web Push (HU-08): la clave pública y alta o baja de la suscripción del dispositivo. */
function registrarRutasDeAvisos(
  app: Parameters<FastifyPluginAsyncZod>[0],
  avisos: AvisosPush,
  conToken: { preHandler: ReturnType<typeof exigirToken> },
): void {
  app.get(
    '/notificaciones/clave-publica',
    {
      schema: {
        tags: ['avisos'],
        summary: 'Clave VAPID pública para suscribirse a los avisos (HU-08)',
        response: { 200: http.esquemaClavePublicaPush, ...ERRORES },
      },
    },
    () => Promise.resolve({ clavePublica: avisos.clavePublica }),
  );

  app.post(
    '/notificaciones/push',
    {
      ...conToken,
      schema: {
        tags: ['avisos'],
        summary: 'Recibir avisos de las zonas en este dispositivo (HU-08)',
        description: 'Idempotente por endpoint: repetirla actualiza la suscripción.',
        security: SEGURIDAD_BEARER,
        body: http.esquemaSuscripcionPush,
        response: { 204: http.esquemaSinContenido, ...ERRORES },
      },
    },
    async (request, reply) => {
      await avisos.registrar.ejecutar({
        idUsuario: identidadDe(request).idUsuario,
        endpoint: request.body.endpoint,
        ...request.body.keys,
      });
      return reply.code(204).send();
    },
  );

  app.delete(
    '/notificaciones/push',
    {
      ...conToken,
      schema: {
        tags: ['avisos'],
        summary: 'Dejar de recibir avisos en este dispositivo (HU-08)',
        security: SEGURIDAD_BEARER,
        body: http.esquemaBajaPush,
        response: { 204: http.esquemaSinContenido, ...ERRORES },
      },
    },
    async (request, reply) => {
      await avisos.eliminar.ejecutar({
        idUsuario: identidadDe(request).idUsuario,
        endpoint: request.body.endpoint,
      });
      return reply.code(204).send();
    },
  );
}
