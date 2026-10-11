import type { ReportId, UserId } from '@gis/shared-kernel';
import type { ReportSnapshot } from './report-snapshot.js';
import type { Reputation } from './reputation.js';
import type { Vote } from './vote.js';

/**
 * Puerto propio hacia `reports`. La raíz de composición lo conecta con la interfaz
 * pública de ese módulo (ADR-001): `verification` nunca lo importa.
 */
export interface ReportLookup {
  findById(id: ReportId): Promise<ReportSnapshot | null>;
}

export interface VoteRepository {
  findByReport(reportId: ReportId): Promise<readonly Vote[]>;
  exists(reportId: ReportId, voterId: UserId): Promise<boolean>;
  save(vote: Vote): Promise<void>;
}

export interface ReputationRepository {
  findByUser(userId: UserId): Promise<Reputation | null>;
  save(reputation: Reputation): Promise<void>;
}
