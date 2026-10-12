import type { Ejecutor } from '@gis/platform';
import { codigoCategoria } from '@gis/shared-kernel';
import type { CodigoCategoria } from '@gis/shared-kernel';
import { asc, eq } from 'drizzle-orm';
import { Categoria } from '../domain/category.js';
import type { RepositorioDeCategorias } from '../domain/ports.js';
import { categorias } from './schema.js';

type Fila = typeof categorias.$inferSelect;

const aEntidad = (fila: Fila): Categoria =>
  Categoria.crear({
    codigo: codigoCategoria(fila.codigo),
    nombre: fila.nombre,
    ttlMinutos: fila.ttlMinutos,
    radioDuplicadoM: fila.radioDuplicadoM,
    esSensible: fila.esSensible,
  });

export class RepositorioCategoriasPg implements RepositorioDeCategorias {
  constructor(private readonly db: Ejecutor) {}

  async buscarPorCodigo(codigo: CodigoCategoria): Promise<Categoria | null> {
    const [fila] = await this.db.select().from(categorias).where(eq(categorias.codigo, codigo));
    return fila ? aEntidad(fila) : null;
  }

  async buscarTodas(): Promise<readonly Categoria[]> {
    const filas = await this.db.select().from(categorias).orderBy(asc(categorias.codigo));
    return filas.map(aEntidad);
  }
}
