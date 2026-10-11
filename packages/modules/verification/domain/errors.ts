import { DomainError } from '@gis/shared-kernel';

export class AuthorCannotVoteError extends DomainError {
  constructor() {
    super('AUTHOR_CANNOT_VOTE', 'El autor de un reporte no puede votar sobre su propio reporte');
  }
}

export class AlreadyVotedError extends DomainError {
  constructor() {
    super('ALREADY_VOTED', 'El usuario ya votó sobre este reporte');
  }
}

export class TooFarToVoteError extends DomainError {
  constructor(maximoM: number) {
    super('TOO_FAR_TO_VOTE', `Para votar hay que estar a ${maximoM} m o menos del incidente`);
  }
}

export class ReportNotActiveError extends DomainError {
  constructor() {
    super('REPORT_NOT_ACTIVE', 'Solo se puede votar sobre un reporte vigente');
  }
}
