import { http } from '@gis/contracts';
import type { Instantanea, PuntoBase, PuntoProcesado, Vistas } from '@gis/module-evaluation';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { z } from 'zod';
import type { Evaluacion } from '../../composicion/casos-de-uso.js';
import { exigirToken, identidadDe, SEGURIDAD_BEARER } from '../autenticacion.js';
import { ERRORES } from './comun.js';

type App = Parameters<FastifyPluginAsyncZod>[0];
type ConToken = { preHandler: ReturnType<typeof exigirToken> };

const aProcesadoHttp = (p: PuntoProcesado): z.output<typeof http.esquemaPuntoProcesado> => ({
  ...p,
  publicLocation: { ...p.publicLocation },
  caducaEn: p.caducaEn.toISOString(),
  fuenteOficial: p.fuenteOficial as z.output<typeof http.esquemaPuntoProcesado>['fuenteOficial'],
});

const aBaseHttp = (p: PuntoBase): z.output<typeof http.esquemaPuntoBase> => ({
  ...p,
  publicLocation: { ...p.publicLocation },
  recibidoEn: p.recibidoEn.toISOString(),
  fuenteOficial: p.fuenteOficial as z.output<typeof http.esquemaPuntoBase>['fuenteOficial'],
});

const aVistasHttp = (vistas: Vistas): z.output<typeof http.esquemaVistas> => ({
  instante: vistas.instante.toISOString(),
  caja: { ...vistas.caja },
  procesada: vistas.procesada.map(aProcesadoHttp),
  base: vistas.base.map(aBaseHttp),
});

const aInstantaneaHttp = (i: Instantanea): z.output<typeof http.esquemaInstantanea> => ({
  id: i.id,
  nombre: i.nombre,
  creadaEn: i.creadaEn.toISOString(),
  ...aVistasHttp(i),
});

/**
 * Instrumentos de evaluación (ADR-007): exigen token y el caso de uso exige el rol `MODERADOR`.
 * Con `evaluation` apagado no se registran (404).
 */
export function registrarRutasDeEvaluacion(
  app: App,
  evaluacion: Evaluacion,
  conToken: ConToken,
): void {
  const esquema = (summary: string, otros: Record<string, unknown>) => ({
    ...conToken,
    schema: { tags: ['evaluación'], summary, security: SEGURIDAD_BEARER, ...otros },
  });

  app.get(
    '/evaluacion/estado',
    esquema('Estado del registro de la evaluación (ADR-007, rol MODERADOR)', {
      description:
        'Cuántos envíos lleva registrados y cuándo llegó el último. La prueba de humo lo usa ' +
        'para comprobar que el módulo registra.',
      response: { 200: http.esquemaEstadoDelRegistro, ...ERRORES },
    }),
    async (request) => {
      const estado = await evaluacion.estado.ejecutar({ rolActor: identidadDe(request).rol });
      return {
        enviosRegistrados: estado.enviosRegistrados,
        ultimoEnvioEn: estado.ultimoEnvioEn?.toISOString() ?? null,
      };
    },
  );

  app.get(
    '/evaluacion/vistas',
    esquema('Vista procesada y vista base de una zona en un instante (HU-14, rol MODERADOR)', {
      description:
        'Reconstruidas desde el registro propio. Sirven para elegir qué congelar: las tareas ' +
        'usan instantáneas, nunca esta consulta.',
      querystring: http.esquemaConsultaVistas,
      response: { 200: http.esquemaVistas, ...ERRORES },
    }),
    async (request) => {
      const { instante, bbox } = request.query as z.output<typeof http.esquemaConsultaVistas>;
      const vistas = await evaluacion.vistas.ejecutar({
        rolActor: identidadDe(request).rol,
        instante,
        caja: bbox,
      });
      return aVistasHttp(vistas);
    },
  );

  app.post(
    '/evaluacion/instantaneas',
    esquema('Congela las dos vistas de una zona en un instante (HU-14, rol MODERADOR)', {
      description: 'La instantánea es inmutable. El nombre (E1, E2...) no se puede repetir.',
      body: http.esquemaNuevaInstantanea,
      response: { 201: http.esquemaInstantanea, ...ERRORES },
    }),
    async (request, reply) => {
      const { nombre, instante, bbox } = request.body as z.output<
        typeof http.esquemaNuevaInstantanea
      >;
      const instantanea = await evaluacion.congelar.ejecutar({
        rolActor: identidadDe(request).rol,
        nombre,
        instante,
        caja: bbox,
      });
      return reply.code(201).send(aInstantaneaHttp(instantanea));
    },
  );

  app.get(
    '/evaluacion/instantaneas',
    esquema('Instantáneas congeladas (HU-14, rol MODERADOR)', {
      response: { 200: http.esquemaListaDeInstantaneas, ...ERRORES },
    }),
    async (request) => {
      const lista = await evaluacion.listarInstantaneas.ejecutar({
        rolActor: identidadDe(request).rol,
      });
      return {
        instantaneas: lista.map((r) => ({
          ...r,
          instante: r.instante.toISOString(),
          caja: { ...r.caja },
          creadaEn: r.creadaEn.toISOString(),
        })),
      };
    },
  );

  app.get(
    '/evaluacion/instantaneas/:id',
    esquema('Una instantánea con los puntos de ambas vistas (HU-14, rol MODERADOR)', {
      params: http.esquemaParametroId,
      response: { 200: http.esquemaInstantanea, ...ERRORES },
    }),
    async (request) => {
      const { id } = request.params as z.output<typeof http.esquemaParametroId>;
      const instantanea = await evaluacion.obtenerInstantanea.ejecutar({
        rolActor: identidadDe(request).rol,
        id,
      });
      return aInstantaneaHttp(instantanea);
    },
  );
}
