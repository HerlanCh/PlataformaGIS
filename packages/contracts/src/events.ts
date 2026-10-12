import { z } from 'zod';
import { definirEvento } from './integration-event.js';
import type { DefinicionDeEvento } from './integration-event.js';

const esquemaPuntoGeo = z.object({ latitud: z.number(), longitud: z.number() });
const esquemaCodigoCategoria = z.string().regex(/^[a-z][a-z0-9_]*$/);

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

export const reporteConfirmadoV1 = definirEvento(
  'ReporteConfirmado',
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

/** Catálogo de eventos de integración publicados. */
export const eventosDeIntegracion: readonly DefinicionDeEvento[] = [
  reporteCreadoV1,
  reporteConfirmadoV1,
  reporteResueltoV1,
  reporteCaducadoV1,
  reporteRechazadoV1,
  reporteDuplicadoDetectadoV1,
  votoEmitidoV1,
];
