import type {
  CajaGeografica,
  CodigoCategoria,
  IdReporte,
  IdUsuario,
  PuntoGeo,
} from '@gis/shared-kernel';
import type { Categoria } from './category.js';
import type { EstadoReporte, Reporte } from './report.js';
import type { ReportePublico } from './reporte-publico.js';

export interface RepositorioDeReportes {
  buscarPorId(id: IdReporte): Promise<Reporte | null>;
  buscarPorClaveDeIdempotencia(idempotencyKey: string): Promise<Reporte | null>;
  guardar(report: Reporte): Promise<void>;

  /**
   * Reportes cuya ubicación pública cae dentro de la caja (bordes incluidos), del más reciente
   * al más antiguo y hasta `limite`. Devuelve la proyección pública. Una lista vacía de
   * categorías significa "todas"; los estados son obligatorios, para que nunca se publiquen por
   * descuido los reportes rechazados.
   * @throws {RangeError} si no se indica ningún estado o el límite no es un entero positivo.
   */
  buscarEnVentana(
    caja: CajaGeografica,
    categorias: readonly CodigoCategoria[],
    estados: readonly EstadoReporte[],
    limite: number,
  ): Promise<readonly ReportePublico[]>;

  /**
   * Reportes vigentes (`ACTIVO` o `CONFIRMADO`) a `radioM` metros o menos del punto, medidos
   * sobre la ubicación real, del más cercano al más lejano y hasta `limite`. Es de uso interno
   * del servidor: la ubicación real no sale de él.
   * @throws {RangeError} si el radio no es un número positivo o el límite no es un entero positivo.
   */
  buscarCercanos(punto: PuntoGeo, radioM: number, limite: number): Promise<readonly Reporte[]>;

  /**
   * Reporte vigente (`ACTIVO` o `CONFIRMADO`, no caducado a `ahora`) de la misma categoría
   * dentro de su radio de deduplicación; si hay varios, el más cercano.
   */
  buscarDuplicado(categoria: Categoria, punto: PuntoGeo, ahora: Date): Promise<Reporte | null>;

  /**
   * Reportes vigentes cuya caducidad es anterior a `ahora`, del más antiguo al más reciente,
   * en lotes de hasta `limite`.
   * @throws {RangeError} si el límite no es un entero positivo.
   */
  buscarCaducados(ahora: Date, limite: number): Promise<readonly Reporte[]>;

  /**
   * Reportes del autor creados entre `desde` y `hasta` (ambos incluidos), en cualquier estado.
   * Lo usa el clasificador para detectar a quien reporta en ráfaga (HU-10).
   */
  contarDelAutor(authorId: IdUsuario, desde: Date, hasta: Date): Promise<number>;
}

export interface RepositorioDeCategorias {
  buscarPorCodigo(code: CodigoCategoria): Promise<Categoria | null>;
  buscarTodas(): Promise<readonly Categoria[]>;
}

/**
 * Consulta de `reports` sobre el autor. La reputación es de `verification`; la raíz de
 * composición conecta este puerto con su interfaz pública (ADR-001).
 */
export interface ReputacionDelAutor {
  /** `true` si el usuario está silenciado (SRS 3.2.7). */
  estaSilenciado(authorId: IdUsuario): Promise<boolean>;
}
