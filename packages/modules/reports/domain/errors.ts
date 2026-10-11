import { DomainError } from '@gis/shared-kernel';

export class InvalidTransitionError extends DomainError {
  constructor(desde: string, hacia: string) {
    super('INVALID_TRANSITION', `Un reporte ${desde} no puede pasar a ${hacia}`);
  }
}

export class ExtensionLimitReachedError extends DomainError {
  constructor() {
    super('EXTENSION_LIMIT_REACHED', 'El reporte ya usó todas sus extensiones de vigencia');
  }
}

export class NotExpiredYetError extends DomainError {
  constructor() {
    super('NOT_EXPIRED_YET', 'El reporte todavía no alcanzó su fecha de caducidad');
  }
}
