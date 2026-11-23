// Instrumentos de evaluación (ADR-007, HU-14): instantáneas, tarea cronometrada, etiquetado y
// verificación. Solo en línea y con el rol MODERADOR; la pantalla renueva el token al abrirse.
import type {
  Acuerdo,
  EnviosParaEtiquetar,
  Instantanea,
  NuevaVerificacion,
  ResumenDeInstantanea,
  Sesion,
  Sorteo,
  Tarea,
  TareaEnCurso,
  Verificacion,
} from '@gis/api-client';
import type { Caja } from '../domain/geo.js';
import { esRechazo, JSON_CABECERA, pedirConToken, rechazoDe } from './peticion.js';
import type { Rechazo } from './peticion.js';

export type {
  Acuerdo,
  EnviosParaEtiquetar,
  Instantanea,
  NuevaVerificacion,
  ResumenDeInstantanea,
  Sesion,
  Sorteo,
  Tarea,
  TareaEnCurso,
  Verificacion,
};

export type Evaluador = 'A' | 'B' | 'CONSENSO';

export interface Periodo {
  readonly desde: string;
  readonly hasta: string;
}

/** La API rechazó la operación, o no respondió (`rechazo` nulo). */
export class ErrorDeEvaluacion extends Error {
  constructor(readonly rechazo: Rechazo | null) {
    super(rechazo ? rechazo.codigo : 'No se pudo completar la operación');
  }
}

/** `lonMin,latMin,lonMax,latMax`, como espera la API. */
export const bboxDe = (caja: Caja): string =>
  [caja.longitudMin, caja.latitudMin, caja.longitudMax, caja.latitudMax]
    .map((n) => n.toFixed(5))
    .join(',');

const consultaDe = (valores: Record<string, string>): string =>
  new URLSearchParams(valores).toString();

/** Cliente de las rutas `/v1/evaluacion/*`. `pedir` se inyecta en las pruebas. */
export function clienteDeEvaluacion(urlApi: string, pedir: typeof fetch = fetch) {
  async function llamar<T>(
    ruta: string,
    init: RequestInit & { headers?: Record<string, string> } = {},
  ): Promise<T> {
    const respuesta = await pedirConToken(urlApi, pedir, `/v1/evaluacion${ruta}`, init);
    if (!respuesta.ok) {
      throw new ErrorDeEvaluacion(esRechazo(respuesta) ? await rechazoDe(respuesta) : null);
    }
    return (respuesta.status === 204 ? undefined : await respuesta.json()) as T;
  }
  const enviar = (method: 'POST' | 'PUT', cuerpo: unknown) => ({
    method,
    headers: JSON_CABECERA,
    body: JSON.stringify(cuerpo),
  });

  return {
    instantaneas: async () =>
      (await llamar<{ instantaneas: ResumenDeInstantanea[] }>('/instantaneas')).instantaneas,
    congelar: (nombre: string, instante: string, caja: Caja) =>
      llamar<Instantanea>(
        '/instantaneas',
        enviar('POST', { nombre, instante, bbox: bboxDe(caja) }),
      ),
    sesiones: async () => (await llamar<{ sesiones: Sesion[] }>('/sesiones')).sesiones,
    crearSesion: (codigoParticipante: string, secuencia: 1 | 2 | 3 | 4) =>
      llamar<Sesion>('/sesiones', enviar('POST', { codigoParticipante, secuencia })),
    iniciarTarea: (idTarea: string) =>
      llamar<TareaEnCurso>(`/tareas/${idTarea}/inicio`, { method: 'POST' }),
    terminarTarea: (
      idTarea: string,
      marcas: readonly { idPunto: string; msDesdeInicio: number }[],
    ) => llamar<Tarea>(`/tareas/${idTarea}/fin`, enviar('POST', { marcas })),
    paraEtiquetar: (evaluador: Evaluador, periodo: Periodo) =>
      llamar<EnviosParaEtiquetar>(`/etiquetado?${consultaDe({ evaluador, ...periodo })}`),
    etiquetar: (
      evaluador: Evaluador,
      asignaciones: readonly { idEnvio: string; grupo: string | null }[],
    ) => llamar<void>('/etiquetado', enviar('PUT', { evaluador, asignaciones })),
    acuerdo: (periodo: Periodo) => llamar<Acuerdo>(`/acuerdo?${consultaDe({ ...periodo })}`),
    sorteo: (periodo: Periodo) =>
      llamar<Sorteo>(`/verificacion/sorteo?${consultaDe({ ...periodo })}`),
    verificar: (idReporte: string, verificacion: NuevaVerificacion) =>
      llamar<Verificacion>(`/verificaciones/${idReporte}`, enviar('PUT', verificacion)),
    verificaciones: async () =>
      (await llamar<{ verificaciones: Verificacion[] }>('/verificaciones')).verificaciones,
  };
}

export type ClienteDeEvaluacion = ReturnType<typeof clienteDeEvaluacion>;
