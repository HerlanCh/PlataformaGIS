import { z } from 'zod';
import { claveDeEvento, definirEvento } from './integration-event.js';
import type { DefinicionDeEvento, EventoDeIntegracion } from './integration-event.js';

export const esquemaPuntoGeo = z.object({ latitud: z.number(), longitud: z.number() });
export const esquemaCodigoCategoria = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** Estados de un reporte (máquina de estados del módulo `reports`). */
export const esquemaEstadoReporte = z.enum([
  'ACTIVO',
  'CONFIRMADO',
  'RESUELTO',
  'CADUCADO',
  'RECHAZADO',
]);

/** Motivo de un rechazo. `AUTOR_SILENCIADO` no penaliza de nuevo al autor (SRS 3.2.7). */
export const esquemaMotivoRechazo = z.enum(['MODERACION', 'AUTOR_SILENCIADO']);

export const esquemaValorVoto = z.enum(['CONFIRMACION', 'NEGACION']);

/** Indicios por los que el clasificador marca un reporte para moderación (HU-10). */
export const esquemaMotivoDeSospecha = z.enum([
  'ENLACE',
  'SPAM',
  'DATOS_PERSONALES',
  'FRECUENCIA_DEL_AUTOR',
  'TEXTO_REPETITIVO',
  'LONGITUD_ANORMAL',
]);

/** Fuente citada por un moderador al publicar un incidente oficial (HU-13). */
export const esquemaFuenteOficial = z.enum(['TRANSITO', 'ABC', 'MI_TELEFERICO', 'OTRA']);

/** Lo que `verification` pide aplicar a `reports` tras un voto (SRS 3.2). */
export const esquemaDecisionVerificacion = z.enum(['NINGUNA', 'CONFIRMAR', 'EXTENDER', 'RESOLVER']);

// --- Eventos públicos: pueden difundirse a los clientes. Solo `publicLocation`. ---

export const reporteCreadoV1 = definirEvento(
  'ReporteCreado',
  1,
  'publico',
  z.object({
    idReporte: z.uuid(),
    codigoCategoria: esquemaCodigoCategoria,
    publicLocation: esquemaPuntoGeo,
    estado: esquemaEstadoReporte,
    creadoEn: z.iso.datetime(),
    caducaEn: z.iso.datetime(),
  }),
);

/** HU-13: agrega la fuente oficial, `null` en los reportes de la comunidad. */
export const reporteCreadoV2 = definirEvento(
  'ReporteCreado',
  2,
  'publico',
  reporteCreadoV1.contenido.extend({ fuenteOficial: esquemaFuenteOficial.nullable() }),
);

export const reporteConfirmadoV1 = definirEvento(
  'ReporteConfirmado',
  1,
  'publico',
  z.object({ idReporte: z.uuid(), caducaEn: z.iso.datetime() }),
);

/** Segunda extensión de vigencia de un reporte `CONFIRMADO` (SRS 3.2.4). */
export const reporteExtendidoV1 = definirEvento(
  'ReporteExtendido',
  1,
  'publico',
  z.object({ idReporte: z.uuid(), caducaEn: z.iso.datetime() }),
);

export const reporteResueltoV1 = definirEvento(
  'ReporteResuelto',
  1,
  'publico',
  z.object({ idReporte: z.uuid() }),
);

export const reporteCaducadoV1 = definirEvento(
  'ReporteCaducado',
  1,
  'publico',
  z.object({ idReporte: z.uuid() }),
);

export const reporteRechazadoV1 = definirEvento(
  'ReporteRechazado',
  1,
  'publico',
  z.object({ idReporte: z.uuid(), motivo: esquemaMotivoRechazo }),
);

// --- Eventos internos: solo entre módulos del servidor. ---

/** Un reporte nuevo cayó en el radio de deduplicación de otro vigente (HU-01, escenario 2). */
export const reporteDuplicadoDetectadoV1 = definirEvento(
  'ReporteDuplicadoDetectado',
  1,
  'interno',
  z.object({
    idReporteExistente: z.uuid(),
    idReportante: z.uuid(),
    ubicacionReportante: esquemaPuntoGeo,
  }),
);

export const votoEmitidoV1 = definirEvento(
  'VotoEmitido',
  1,
  'interno',
  z.object({
    idReporte: z.uuid(),
    idVotante: z.uuid(),
    valor: esquemaValorVoto,
    peso: z.number().min(0).max(5),
    decision: esquemaDecisionVerificacion,
  }),
);

/** Un moderador rechazó un reporte; `reports` aplica el cambio de estado (HU-12). */
export const rechazoDeModeracionV1 = definirEvento(
  'RechazoDeModeracion',
  1,
  'interno',
  z.object({ idReporte: z.uuid(), idModerador: z.uuid() }),
);

/**
 * El autor describió su reporte (HU-10). Solo lleva el ID: la descripción es privada y quien la
 * necesite la pide por un puerto.
 */
export const descripcionAgregadaV1 = definirEvento(
  'DescripcionAgregada',
  1,
  'interno',
  z.object({ idReporte: z.uuid() }),
);

/**
 * El clasificador revisó un reporte (HU-10). `sospechoso` lo lleva a la cola de moderación;
 * `clasificador` dice qué implementación decidió (las reglas o el modelo).
 */
export const reporteClasificadoV1 = definirEvento(
  'ReporteClasificado',
  1,
  'interno',
  z.object({
    idReporte: z.uuid(),
    sospechoso: z.boolean(),
    motivos: z.array(esquemaMotivoDeSospecha),
    clasificador: z.string().min(1),
  }),
);

/** Catálogo de eventos de integración publicados. */
export const eventosDeIntegracion: readonly DefinicionDeEvento[] = [
  reporteCreadoV1,
  reporteConfirmadoV1,
  reporteExtendidoV1,
  reporteResueltoV1,
  reporteCaducadoV1,
  reporteRechazadoV1,
  reporteDuplicadoDetectadoV1,
  votoEmitidoV1,
  rechazoDeModeracionV1,
  descripcionAgregadaV1,
  reporteClasificadoV1,
  reporteCreadoV2,
];

/**
 * Claves de `ReporteCreado`. Se publica la v2; quien lo escucha también acepta la v1, que puede
 * quedar pendiente en el outbox de un despliegue anterior.
 */
export const CLAVES_REPORTE_CREADO = [reporteCreadoV1.clave, reporteCreadoV2.clave] as const;

/**
 * Contenido de un `ReporteCreado` de cualquier versión, en la forma de la v2: la v1 era siempre
 * de la comunidad.
 * @throws {Error} si el evento no es un `ReporteCreado`.
 */
export function leerReporteCreado(
  evento: EventoDeIntegracion,
): z.output<typeof reporteCreadoV2.contenido> {
  if (claveDeEvento(evento) === reporteCreadoV1.clave) {
    return { ...reporteCreadoV1.contenido.parse(evento.contenido), fuenteOficial: null };
  }
  if (claveDeEvento(evento) === reporteCreadoV2.clave) {
    return reporteCreadoV2.contenido.parse(evento.contenido);
  }
  throw new Error(`Se esperaba ReporteCreado y llegó ${claveDeEvento(evento)}`);
}
