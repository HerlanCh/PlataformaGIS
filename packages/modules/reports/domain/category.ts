import { categoryCode, DomainError } from '@gis/shared-kernel';
import type { CategoryCode } from '@gis/shared-kernel';

export interface CategoryProps {
  readonly code: CategoryCode;
  readonly name: string;
  /** Tiempo de vida inicial de un reporte, en minutos. */
  readonly ttlMinutes: number;
  /** Radio dentro del cual otro reporte de la misma categoría es un duplicado, en metros. */
  readonly dedupRadiusM: number;
  /** Si es sensible, la ubicación pública se ofusca (`PrivacyPolicy`). */
  readonly isSensitive: boolean;
}

export class InvalidCategoryError extends DomainError {
  constructor(detalle: string) {
    super('INVALID_CATEGORY', `Categoría inválida: ${detalle}`);
  }
}

const enteroPositivo = (valor: number): boolean => Number.isInteger(valor) && valor > 0;

export class Category {
  readonly code: CategoryCode;
  readonly name: string;
  readonly ttlMinutes: number;
  readonly dedupRadiusM: number;
  readonly isSensitive: boolean;

  private constructor(props: CategoryProps) {
    this.code = props.code;
    this.name = props.name;
    this.ttlMinutes = props.ttlMinutes;
    this.dedupRadiusM = props.dedupRadiusM;
    this.isSensitive = props.isSensitive;
    Object.freeze(this);
  }

  /** @throws {InvalidCategoryError} si el nombre está vacío o el TTL o el radio no son enteros positivos. */
  static create(props: CategoryProps): Category {
    if (props.name.trim() === '') throw new InvalidCategoryError('el nombre está vacío');
    if (!enteroPositivo(props.ttlMinutes)) {
      throw new InvalidCategoryError('el TTL debe ser un entero positivo de minutos');
    }
    if (!enteroPositivo(props.dedupRadiusM)) {
      throw new InvalidCategoryError(
        'el radio de deduplicación debe ser un entero positivo de metros',
      );
    }
    return new Category({ ...props, name: props.name.trim() });
  }
}

const mvp = (
  code: string,
  name: string,
  ttlMinutes: number,
  dedupRadiusM: number,
  isSensitive = false,
): Category =>
  Category.create({ code: categoryCode(code), name, ttlMinutes, dedupRadiusM, isSensitive });

/** Las cinco categorías del MVP con sus parámetros (SRS 3.1). */
export const MVP_CATEGORIES: readonly Category[] = [
  mvp('bloqueo', 'Bloqueo o protesta vial', 360, 100),
  mvp('accidente', 'Accidente de tránsito', 180, 50),
  mvp('robo', 'Hecho delictivo / robo', 120, 200, true),
  mvp('infraestructura', 'Derrumbe / vía dañada / fuga', 1440, 50),
  mvp('jauria', 'Jauría de perros agresivos', 120, 150),
];
