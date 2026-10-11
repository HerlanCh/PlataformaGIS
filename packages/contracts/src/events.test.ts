import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  integrationEvents,
  reportCreatedV1,
  reportDuplicateDetectedV1,
  reportRejectedV1,
  voteCastV1,
} from './index.js';

const ID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';
const sobre = { id: ID, occurredAt: '2026-10-11T12:00:00Z' };

/** Nombres de todos los campos de un esquema, incluidos los anidados. */
function campos(esquema: z.ZodType): string[] {
  if (!(esquema instanceof z.ZodObject)) return [];
  return Object.entries(esquema.shape as Record<string, z.ZodType>).flatMap(([nombre, hijo]) => [
    nombre,
    ...campos(hijo),
  ]);
}

describe('catálogo de eventos de integración', () => {
  it('contiene los siete eventos de la Fase 2 con clave única', () => {
    const claves = integrationEvents.map((evento) => evento.key);

    expect(claves).toEqual([
      'ReportCreated.v1',
      'ReportConfirmed.v1',
      'ReportResolved.v1',
      'ReportExpired.v1',
      'ReportRejected.v1',
      'ReportDuplicateDetected.v1',
      'VoteCast.v1',
    ]);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('RNF-14: ningún evento público lleva ubicación real, autor ni otro usuario', () => {
    const prohibidos = ['location', 'authorId', 'reporterId', 'voterId', 'reporterLocation'];
    const publicos = integrationEvents.filter((evento) => evento.audience === 'public');

    expect(publicos.length).toBeGreaterThan(0);
    for (const evento of publicos) {
      const presentes = campos(evento.payload);
      expect(presentes.filter((campo) => prohibidos.includes(campo))).toEqual([]);
    }
  });

  it('los eventos que identifican a un usuario son internos', () => {
    expect(reportDuplicateDetectedV1.audience).toBe('internal');
    expect(voteCastV1.audience).toBe('internal');
  });
});

describe('contratos', () => {
  const creado = {
    ...sobre,
    type: 'ReportCreated',
    version: 1,
    payload: {
      reportId: ID,
      categoryCode: 'bloqueo',
      publicLocation: { latitude: -16.5, longitude: -68.15 },
      status: 'ACTIVO',
      createdAt: '2026-10-11T12:00:00Z',
      expiresAt: '2026-10-11T18:00:00Z',
    },
  };

  it('ReportCreated.v1 acepta un evento válido', () => {
    expect(reportCreatedV1.schema.parse(creado)).toEqual(creado);
  });

  it('ReportCreated.v1 descarta un campo que no está en el contrato', () => {
    const conAutor = { ...creado, payload: { ...creado.payload, authorId: ID } };

    expect(reportCreatedV1.schema.parse(conAutor).payload).not.toHaveProperty('authorId');
  });

  it('ReportCreated.v1 rechaza un estado desconocido', () => {
    const invalido = { ...creado, payload: { ...creado.payload, status: 'BORRADO' } };

    expect(reportCreatedV1.schema.safeParse(invalido).success).toBe(false);
  });

  it('ReportRejected.v1 solo admite motivos del catálogo', () => {
    const rechazado = (reason: string) => ({
      ...sobre,
      type: 'ReportRejected',
      version: 1,
      payload: { reportId: ID, reason },
    });

    expect(reportRejectedV1.schema.safeParse(rechazado('MODERACION')).success).toBe(true);
    expect(reportRejectedV1.schema.safeParse(rechazado('AUTOR_SILENCIADO')).success).toBe(true);
    expect(reportRejectedV1.schema.safeParse(rechazado('porque sí')).success).toBe(false);
  });

  it('VoteCast.v1 lleva la decisión de verificación y limita el peso al rango de reputación', () => {
    const voto = (weight: number, decision: string) => ({
      ...sobre,
      type: 'VoteCast',
      version: 1,
      payload: { reportId: ID, voterId: ID, value: 'CONFIRMACION', weight, decision },
    });

    expect(voteCastV1.schema.safeParse(voto(1, 'CONFIRM')).success).toBe(true);
    expect(voteCastV1.schema.safeParse(voto(5.1, 'NONE')).success).toBe(false);
    expect(voteCastV1.schema.safeParse(voto(1, 'BORRAR')).success).toBe(false);
  });
});
