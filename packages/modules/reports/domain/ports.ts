import type { CodigoCategoria, IdReporte, IdUsuario } from '@gis/shared-kernel';
import type { Categoria } from './category.js';
import type { Reporte } from './report.js';

/** Las consultas espaciales (viewport, cercanía, duplicados, vencidos) se añaden en la Fase 4. */
export interface RepositorioDeReportes {
  buscarPorId(id: IdReporte): Promise<Reporte | null>;
  buscarPorClaveDeIdempotencia(idempotencyKey: string): Promise<Reporte | null>;
  guardar(report: Reporte): Promise<void>;
}

export interface RepositorioDeCategorias {
  buscarPorCodigo(code: CodigoCategoria): Promise<Categoria | null>;
  buscarTodas(): Promise<readonly Categoria[]>;
}

/** Genera identificadores únicos (UUID). El dominio no los crea por sí mismo. */
export interface GeneradorDeId {
  siguiente(): string;
}

/**
 * Consulta de `reports` sobre el autor. La reputación es de `verification`; la raíz de
 * composición conecta este puerto con su interfaz pública (ADR-001).
 */
export interface ReputacionDelAutor {
  /** `true` si el usuario está silenciado (SRS 3.2.7). */
  estaSilenciado(authorId: IdUsuario): Promise<boolean>;
}
