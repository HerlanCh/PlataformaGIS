import type { CategoryCode, ReportId, UserId } from '@gis/shared-kernel';
import type { Category } from './category.js';
import type { Report } from './report.js';

/** Las consultas espaciales (viewport, cercanía, duplicados, vencidos) se añaden en la Fase 4. */
export interface ReportRepository {
  findById(id: ReportId): Promise<Report | null>;
  save(report: Report): Promise<void>;
}

export interface CategoryRepository {
  findByCode(code: CategoryCode): Promise<Category | null>;
  findAll(): Promise<readonly Category[]>;
}

/** Genera identificadores únicos (UUID). El dominio no los crea por sí mismo. */
export interface IdGenerator {
  next(): string;
}

/**
 * Consulta de `reports` sobre el autor. La reputación es de `verification`; la raíz de
 * composición conecta este puerto con su interfaz pública (ADR-001).
 */
export interface AuthorStanding {
  /** `true` si el usuario está silenciado (SRS 3.2.7). */
  isSilenced(authorId: UserId): Promise<boolean>;
}
