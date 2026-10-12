import type { Executor } from '@gis/platform';
import { categoryCode } from '@gis/shared-kernel';
import type { CategoryCode } from '@gis/shared-kernel';
import { asc, eq } from 'drizzle-orm';
import { Category } from '../domain/category.js';
import type { CategoryRepository } from '../domain/ports.js';
import { categories } from './schema.js';

type Fila = typeof categories.$inferSelect;

const aEntidad = (fila: Fila): Category =>
  Category.create({
    code: categoryCode(fila.code),
    name: fila.name,
    ttlMinutes: fila.ttlMinutes,
    dedupRadiusM: fila.dedupRadiusM,
    isSensitive: fila.isSensitive,
  });

export class PgCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Executor) {}

  async findByCode(code: CategoryCode): Promise<Category | null> {
    const [fila] = await this.db.select().from(categories).where(eq(categories.code, code));
    return fila ? aEntidad(fila) : null;
  }

  async findAll(): Promise<readonly Category[]> {
    const filas = await this.db.select().from(categories).orderBy(asc(categories.code));
    return filas.map(aEntidad);
  }
}
