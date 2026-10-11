import { z } from 'zod';
import { defineEvent } from './integration-event.js';
import type { EventDefinition } from './integration-event.js';

const geoPointSchema = z.object({ latitude: z.number(), longitude: z.number() });
const categoryCodeSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** Estados de un reporte (máquina de estados del módulo `reports`). */
export const reportStatusSchema = z.enum([
  'ACTIVO',
  'CONFIRMADO',
  'RESUELTO',
  'CADUCADO',
  'RECHAZADO',
]);

/** Motivo de un rechazo. `AUTOR_SILENCIADO` no penaliza de nuevo al autor (SRS 3.2.7). */
export const rejectionReasonSchema = z.enum(['MODERACION', 'AUTOR_SILENCIADO']);

export const voteValueSchema = z.enum(['CONFIRMACION', 'NEGACION']);

/** Lo que `verification` pide aplicar a `reports` tras un voto (SRS 3.2). */
export const verificationDecisionSchema = z.enum(['NONE', 'CONFIRM', 'EXTEND', 'RESOLVE']);

// --- Eventos públicos: pueden difundirse a los clientes. Solo `publicLocation`. ---

export const reportCreatedV1 = defineEvent(
  'ReportCreated',
  1,
  'public',
  z.object({
    reportId: z.uuid(),
    categoryCode: categoryCodeSchema,
    publicLocation: geoPointSchema,
    status: reportStatusSchema,
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  }),
);

export const reportConfirmedV1 = defineEvent(
  'ReportConfirmed',
  1,
  'public',
  z.object({ reportId: z.uuid(), expiresAt: z.iso.datetime() }),
);

export const reportResolvedV1 = defineEvent(
  'ReportResolved',
  1,
  'public',
  z.object({ reportId: z.uuid() }),
);

export const reportExpiredV1 = defineEvent(
  'ReportExpired',
  1,
  'public',
  z.object({ reportId: z.uuid() }),
);

export const reportRejectedV1 = defineEvent(
  'ReportRejected',
  1,
  'public',
  z.object({ reportId: z.uuid(), reason: rejectionReasonSchema }),
);

// --- Eventos internos: solo entre módulos del servidor. ---

/** Un reporte nuevo cayó en el radio de deduplicación de otro vigente (HU-01, escenario 2). */
export const reportDuplicateDetectedV1 = defineEvent(
  'ReportDuplicateDetected',
  1,
  'internal',
  z.object({
    existingReportId: z.uuid(),
    reporterId: z.uuid(),
    reporterLocation: geoPointSchema,
  }),
);

export const voteCastV1 = defineEvent(
  'VoteCast',
  1,
  'internal',
  z.object({
    reportId: z.uuid(),
    voterId: z.uuid(),
    value: voteValueSchema,
    weight: z.number().min(0).max(5),
    decision: verificationDecisionSchema,
  }),
);

/** Catálogo de eventos de integración publicados. */
export const integrationEvents: readonly EventDefinition[] = [
  reportCreatedV1,
  reportConfirmedV1,
  reportResolvedV1,
  reportExpiredV1,
  reportRejectedV1,
  reportDuplicateDetectedV1,
  voteCastV1,
];
