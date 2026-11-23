import { http } from '@gis/contracts';
import { DURACION_DE_TAREA_MS, KAPPA_MINIMO } from '@gis/module-evaluation';
import type {
  ReporteVerificable,
  Sesion,
  Tarea,
  TareaEnCurso,
  Verificacion,
} from '@gis/module-evaluation';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { z } from 'zod';
import type { Evaluacion } from '../../composicion/casos-de-uso.js';
import { exigirToken, identidadDe, SEGURIDAD_BEARER } from '../autenticacion.js';
import { ERRORES } from './comun.js';

type App = Parameters<FastifyPluginAsyncZod>[0];
type ConToken = { preHandler: ReturnType<typeof exigirToken> };
type Fuente = z.output<typeof http.esquemaPuntoBase>['fuenteOficial'];

const iso = (fecha: Date | null): string | null => fecha?.toISOString() ?? null;

const aTareaHttp = (t: Tarea): z.output<typeof http.esquemaTarea> => ({
  id: t.id,
  orden: t.orden,
  vista: t.vista,
  escenario: t.escenario,
  idInstantanea: t.idInstantanea,
  iniciadaEn: iso(t.iniciadaEn),
  terminadaEn: iso(t.terminadaEn),
  duracionMs: t.duracionMs,
  agotada: t.agotada,
  marcas: t.marcas.map((m) => ({ ...m })),
});

const aSesionHttp = (s: Sesion): z.output<typeof http.esquemaSesion> => ({
  id: s.id,
  codigoParticipante: s.codigoParticipante,
  secuencia: s.secuencia,
  creadaEn: s.creadaEn.toISOString(),
  tareas: s.tareas.map(aTareaHttp),
});

/** Sin la vista: el participante no debe saber cuál le tocó. */
const aTareaEnCursoHttp = ({ tarea, puntos, caja }: TareaEnCurso) => ({
  idTarea: tarea.id,
  orden: tarea.orden,
  iniciadaEn: tarea.iniciadaEn!.toISOString(),
  duracionMaximaMs: DURACION_DE_TAREA_MS,
  caja: { ...caja },
  puntos: puntos.map((p) => ({
    idPunto: 'idEnvio' in p ? p.idEnvio : p.idReporte,
    codigoCategoria: p.codigoCategoria,
    publicLocation: { ...p.publicLocation },
    estado: 'estado' in p ? p.estado : null,
    fuenteOficial: p.fuenteOficial as Fuente,
  })),
});

const aVerificableHttp = (r: ReporteVerificable) => ({
  ...r,
  publicLocation: { ...r.publicLocation },
  creadoEn: r.creadoEn.toISOString(),
});

const aVerificacionHttp = (v: Verificacion): z.output<typeof http.esquemaVerificacion> => ({
  ...v,
  finEn: iso(v.finEn),
  registradaEn: v.registradaEn.toISOString(),
});

/** Tarea cronometrada, etiquetado y verificación (ADR-007). El caso de uso exige el rol. */
export function registrarRutasDeHerramientas(
  app: App,
  evaluacion: Evaluacion,
  conToken: ConToken,
): void {
  const esquema = (summary: string, otros: Record<string, unknown>) => ({
    ...conToken,
    schema: { tags: ['evaluación'], summary, security: SEGURIDAD_BEARER, ...otros },
  });
  const rol = (request: Parameters<typeof identidadDe>[0]) => identidadDe(request).rol;

  app.post(
    '/evaluacion/sesiones',
    esquema('Abre la sesión de un participante (HU-14, rol MODERADOR)', {
      description: 'Exige las instantáneas E1 y E2. Un código de participante no se repite.',
      body: http.esquemaNuevaSesion,
      response: { 201: http.esquemaSesion, ...ERRORES },
    }),
    async (request, reply) => {
      const cuerpo = request.body as z.output<typeof http.esquemaNuevaSesion>;
      const sesion = await evaluacion.crearSesion.ejecutar({ ...cuerpo, rolActor: rol(request) });
      return reply.code(201).send(aSesionHttp(sesion));
    },
  );

  app.get(
    '/evaluacion/sesiones',
    esquema('Sesiones de la tarea cronometrada (HU-14, rol MODERADOR)', {
      response: { 200: http.esquemaListaDeSesiones, ...ERRORES },
    }),
    async (request) => {
      const sesiones = await evaluacion.listarSesiones.ejecutar({ rolActor: rol(request) });
      return { sesiones: sesiones.map(aSesionHttp) };
    },
  );

  app.post(
    '/evaluacion/tareas/:id/inicio',
    esquema('Empieza una tarea: el servidor fija la hora (HU-14, rol MODERADOR)', {
      params: http.esquemaParametroId,
      response: { 200: http.esquemaTareaEnCurso, ...ERRORES },
    }),
    async (request) => {
      const { id } = request.params as z.output<typeof http.esquemaParametroId>;
      return aTareaEnCursoHttp(
        await evaluacion.iniciarTarea.ejecutar({ rolActor: rol(request), idTarea: id }),
      );
    },
  );

  app.post(
    '/evaluacion/tareas/:id/fin',
    esquema('Cierra una tarea con los puntos marcados (HU-14, rol MODERADOR)', {
      params: http.esquemaParametroId,
      body: http.esquemaFinDeTarea,
      response: { 200: http.esquemaTarea, ...ERRORES },
    }),
    async (request) => {
      const { id } = request.params as z.output<typeof http.esquemaParametroId>;
      const { marcas } = request.body as z.output<typeof http.esquemaFinDeTarea>;
      const tarea = await evaluacion.terminarTarea.ejecutar({
        rolActor: rol(request),
        idTarea: id,
        marcas,
      });
      return aTareaHttp(tarea);
    },
  );

  app.get(
    '/evaluacion/etiquetado',
    esquema('Envíos del periodo para etiquetar (HU-14, rol MODERADOR)', {
      description:
        'Etiquetado ciego: no trae el reporte de la plataforma ni las etiquetas del otro.',
      querystring: http.esquemaConsultaEtiquetado,
      response: { 200: http.esquemaEnviosParaEtiquetar, ...ERRORES },
    }),
    async (request) => {
      const { evaluador, ...periodo } = request.query as z.output<
        typeof http.esquemaConsultaEtiquetado
      >;
      const { envios, etiquetas } = await evaluacion.enviosParaEtiquetar.ejecutar({
        rolActor: rol(request),
        evaluador,
        periodo,
      });
      return {
        envios: envios.map((e) => ({
          ...e,
          publicLocation: { ...e.publicLocation },
          recibidoEn: e.recibidoEn.toISOString(),
        })),
        etiquetas: etiquetas.map((e) => ({ ...e })),
      };
    },
  );

  app.put(
    '/evaluacion/etiquetado',
    esquema('Guarda o corrige etiquetas de un evaluador (HU-14, rol MODERADOR)', {
      body: http.esquemaAsignaciones,
      response: { 204: http.esquemaSinContenido, ...ERRORES },
    }),
    async (request, reply) => {
      const { evaluador, asignaciones } = request.body as z.output<typeof http.esquemaAsignaciones>;
      await evaluacion.guardarEtiquetas.ejecutar({
        rolActor: rol(request),
        evaluador,
        asignaciones,
      });
      return reply.code(204).send();
    },
  );

  app.get(
    '/evaluacion/acuerdo',
    esquema('Kappa de Cohen entre los evaluadores A y B (HU-14, rol MODERADOR)', {
      querystring: http.esquemaConsultaPeriodo,
      response: { 200: http.esquemaAcuerdo, ...ERRORES },
    }),
    async (request) => {
      const periodo = request.query as z.output<typeof http.esquemaConsultaPeriodo>;
      const acuerdo = await evaluacion.medirAcuerdo.ejecutar({ rolActor: rol(request), periodo });
      return {
        ...acuerdo,
        kappaMinimo: KAPPA_MINIMO,
        desacuerdos: acuerdo.desacuerdos.map((d) => ({ ...d })),
      };
    },
  );

  app.get(
    '/evaluacion/verificacion/sorteo',
    esquema('Sorteo de reportes para verificar (HU-14, rol MODERADOR)', {
      querystring: http.esquemaConsultaPeriodo,
      response: { 200: http.esquemaSorteo, ...ERRORES },
    }),
    async (request) => {
      const periodo = request.query as z.output<typeof http.esquemaConsultaPeriodo>;
      const sorteo = await evaluacion.sortear.ejecutar({ rolActor: rol(request), periodo });
      return {
        confirmados: sorteo.confirmados.map(aVerificableHttp),
        noConfirmados: sorteo.noConfirmados.map(aVerificableHttp),
      };
    },
  );

  app.put(
    '/evaluacion/verificaciones/:id',
    esquema('Registra o corrige la verificación de un reporte (HU-14, rol MODERADOR)', {
      params: http.esquemaParametroId,
      body: http.esquemaNuevaVerificacion,
      response: { 200: http.esquemaVerificacion, ...ERRORES },
    }),
    async (request) => {
      const { id } = request.params as z.output<typeof http.esquemaParametroId>;
      const cuerpo = request.body as z.output<typeof http.esquemaNuevaVerificacion>;
      const verificacion = await evaluacion.registrarVerificacion.ejecutar({
        ...cuerpo,
        rolActor: rol(request),
        idReporte: id,
      });
      return aVerificacionHttp(verificacion);
    },
  );

  app.get(
    '/evaluacion/verificaciones',
    esquema('Verificaciones registradas (HU-14, rol MODERADOR)', {
      response: { 200: http.esquemaListaDeVerificaciones, ...ERRORES },
    }),
    async (request) => {
      const lista = await evaluacion.listarVerificaciones.ejecutar({ rolActor: rol(request) });
      return { verificaciones: lista.map(aVerificacionHttp) };
    },
  );
}
