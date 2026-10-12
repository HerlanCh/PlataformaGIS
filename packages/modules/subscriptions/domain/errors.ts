import { DomainError } from '@gis/shared-kernel';

export class InvalidRadiusError extends DomainError {
  constructor(minimoM: number, maximoM: number) {
    super(
      'INVALID_RADIUS',
      `El radio de una zona debe estar entre ${minimoM} m y ${maximoM} m, en metros enteros`,
    );
  }
}

export class NoCategoriesError extends DomainError {
  constructor() {
    super('NO_CATEGORIES', 'Una zona suscrita necesita al menos una categoría');
  }
}
