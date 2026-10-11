import { GeoPoint, reportId, userId } from '@gis/shared-kernel';
import type { UserId } from '@gis/shared-kernel';
import type { ReportSnapshot } from '../domain/report-snapshot.js';
import { Reputation } from '../domain/reputation.js';
import { Vote } from '../domain/vote.js';
import type { VoteValue } from '../domain/vote.js';

export const ahora = new Date('2026-10-11T12:00:00Z');
export const diasDespues = (dias: number) => new Date(ahora.getTime() + dias * 86_400_000);

/** Identificador de usuario determinista a partir de un número. */
export const usuario = (n: number): UserId =>
  userId(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);

export const AUTOR = usuario(999);
export const ID_REPORTE = reportId('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f');

/** Ubicación del incidente y puntos a distancias conocidas hacia el norte. */
export const lugarDelIncidente = GeoPoint.create(-16.5, -68.15);
const GRADOS_POR_METRO = 1 / 111_195;
export const aMetros = (metros: number) =>
  GeoPoint.create(-16.5 + metros * GRADOS_POR_METRO, -68.15);

export const reporte = (cambios: Partial<ReportSnapshot> = {}): ReportSnapshot => ({
  id: ID_REPORTE,
  authorId: AUTOR,
  status: 'ACTIVO',
  location: lugarDelIncidente,
  extensions: 0,
  ...cambios,
});

export const reputacion = (userIdValue: UserId, score = 1.0): Reputation =>
  Reputation.restore({ userId: userIdValue, score, lastPenaltyAt: null });

/** Voto ya emitido, con el peso indicado. */
export const voto = (n: number, value: VoteValue, weight = 1.0): Vote =>
  Vote.restore({ reportId: ID_REPORTE, voterId: usuario(n), value, weight, castAt: ahora });
