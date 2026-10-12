import { ErrorDeDominio } from './domain-error.js';

declare const brand: unique symbol;

/** Tipo nominal: impide mezclar identificadores que comparten representación. */
export type Marca<T, Name extends string> = T & { readonly [brand]: Name };

export type IdReporte = Marca<string, 'IdReporte'>;
export type IdUsuario = Marca<string, 'IdUsuario'>;
export type CodigoCategoria = Marca<string, 'CodigoCategoria'>;

export class ErrorIdentificadorInvalido extends ErrorDeDominio {
  constructor(tipo: string, valor: string) {
    super('IDENTIFICADOR_INVALIDO', `"${valor}" no es un ${tipo} válido`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO = /^[a-z][a-z0-9_]*$/;

function validar<Id extends string>(tipo: string, patron: RegExp, valor: string): Id {
  if (!patron.test(valor)) throw new ErrorIdentificadorInvalido(tipo, valor);
  return valor as Id;
}

/** @throws {ErrorIdentificadorInvalido} si no es un UUID. */
export const idReporte = (valor: string): IdReporte => validar('IdReporte', UUID, valor);

/** @throws {ErrorIdentificadorInvalido} si no es un UUID. */
export const idUsuario = (valor: string): IdUsuario => validar('IdUsuario', UUID, valor);

/** @throws {ErrorIdentificadorInvalido} si no es un código en minúsculas, como `bloqueo`. */
export const codigoCategoria = (valor: string): CodigoCategoria =>
  validar('CodigoCategoria', CODIGO, valor);
