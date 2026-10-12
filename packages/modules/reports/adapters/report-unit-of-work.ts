import type { IntegrationEvent } from '@gis/contracts';
import { appendToOutbox } from '@gis/platform';
import type { Db } from '@gis/platform';
import type { ReportUnitOfWork } from '../application/ports.js';
import type { Report } from '../domain/report.js';
import { PostgisReportRepository } from './report-repository.js';

export class PgReportUnitOfWork implements ReportUnitOfWork {
  constructor(private readonly db: Db) {}

  async commit(report: Report, events: readonly IntegrationEvent[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await new PostgisReportRepository(tx).save(report);
      await appendToOutbox(tx, events);
    });
  }
}
