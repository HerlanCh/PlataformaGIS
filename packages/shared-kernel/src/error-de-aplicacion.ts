import { ErrorDeDominio } from './domain-error.js';

/**
 * Clase de fallo de un caso de uso. Cada adaptador la traduce a su protocolo
 * (HTTP en la Fase 6: 404, 403, 409, 422 y 429).
 */
export type TipoDeErrorDeAplicacion =
  'NO_ENCONTRADO' | 'PROHIBIDO' | 'CONFLICTO' | 'VALIDACION_FALLIDA' | 'LIMITE_EXCEDIDO';

/** Error que devuelve un caso de uso. `codigo` es estable y lo pueden leer los clientes. */
export class ErrorDeAplicacion extends Error {
  readonly tipo: TipoDeErrorDeAplicacion;
  readonly codigo: string;

  constructor(tipo: TipoDeErrorDeAplicacion, codigo: string, mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
    this.tipo = tipo;
    this.codigo = codigo;
  }
}

export class ErrorNoEncontrado extends ErrorDeAplicacion {
  constructor(codigo: string, mensaje: string) {
    super('NO_ENCONTRADO', codigo, mensaje);
  }
}

export class ErrorProhibido extends ErrorDeAplicacion {
  constructor(codigo: string, mensaje: string) {
    super('PROHIBIDO', codigo, mensaje);
  }
}

export class ErrorConflicto extends ErrorDeAplicacion {
  constructor(codigo: string, mensaje: string) {
    super('CONFLICTO', codigo, mensaje);
  }
}

export class ErrorValidacionFallida extends ErrorDeAplicacion {
  constructor(codigo: string, mensaje: string) {
    super('VALIDACION_FALLIDA', codigo, mensaje);
  }
}

export class ErrorLimiteExcedido extends ErrorDeAplicacion {
  /** Segundos que faltan para que el límite vuelva a admitir la operación. */
  readonly reintentarEnSegundos: number;

  constructor(reintentarEnSegundos: number) {
    super(
      'LIMITE_EXCEDIDO',
      'LIMITE_EXCEDIDO',
      `Demasiadas solicitudes: intenta de nuevo en ${reintentarEnSegundos} s`,
    );
    this.reintentarEnSegundos = reintentarEnSegundos;
  }
}

/**
 * Traduce un error de dominio previsto a un error de aplicación del tipo indicado para su
 * código, conservando código y mensaje. Cualquier otro error se devuelve tal cual.
 * Uso: `catch (error) { throw aErrorDeAplicacion(error, { YA_VOTO: 'CONFLICTO' }); }`.
 */
export function aErrorDeAplicacion(
  error: unknown,
  tipoPorCodigo: Readonly<Record<string, TipoDeErrorDeAplicacion>>,
): unknown {
  if (!(error instanceof ErrorDeDominio)) return error;
  const tipo = tipoPorCodigo[error.codigo];
  return tipo === undefined ? error : new ErrorDeAplicacion(tipo, error.codigo, error.message);
}
