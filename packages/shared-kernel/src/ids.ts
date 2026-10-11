import { DomainError } from './domain-error.js';

declare const brand: unique symbol;

/** Tipo nominal: impide mezclar identificadores que comparten representación. */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };

export type ReportId = Brand<string, 'ReportId'>;
export type UserId = Brand<string, 'UserId'>;
export type CategoryCode = Brand<string, 'CategoryCode'>;

export class InvalidIdentifierError extends DomainError {
  constructor(tipo: string, valor: string) {
    super('INVALID_IDENTIFIER', `"${valor}" no es un ${tipo} válido`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO = /^[a-z][a-z0-9_]*$/;

function validar<Id extends string>(tipo: string, patron: RegExp, valor: string): Id {
  if (!patron.test(valor)) throw new InvalidIdentifierError(tipo, valor);
  return valor as Id;
}

/** @throws {InvalidIdentifierError} si no es un UUID. */
export const reportId = (valor: string): ReportId => validar('ReportId', UUID, valor);

/** @throws {InvalidIdentifierError} si no es un UUID. */
export const userId = (valor: string): UserId => validar('UserId', UUID, valor);

/** @throws {InvalidIdentifierError} si no es un código en minúsculas, como `bloqueo`. */
export const categoryCode = (valor: string): CategoryCode => validar('CategoryCode', CODIGO, valor);
