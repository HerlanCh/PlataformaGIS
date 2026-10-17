import { describe, expect, it } from 'vitest';
import {
  aErrorDeAplicacion,
  ErrorConflicto,
  ErrorDeAplicacion,
  ErrorDeDominio,
  ErrorLimiteExcedido,
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorValidacionFallida,
} from './index.js';

describe('errores de aplicación', () => {
  it.each([
    [new ErrorNoEncontrado('X', 'm'), 'NO_ENCONTRADO', 'ErrorNoEncontrado'],
    [new ErrorProhibido('X', 'm'), 'PROHIBIDO', 'ErrorProhibido'],
    [new ErrorConflicto('X', 'm'), 'CONFLICTO', 'ErrorConflicto'],
    [new ErrorValidacionFallida('X', 'm'), 'VALIDACION_FALLIDA', 'ErrorValidacionFallida'],
  ])('%o lleva su tipo, su código y el nombre de la subclase', (error, tipo, nombre) => {
    expect(error).toBeInstanceOf(ErrorDeAplicacion);
    expect(error).toMatchObject({ tipo, codigo: 'X', message: 'm', name: nombre });
  });

  it('el límite excedido indica cuándo reintentar', () => {
    const error = new ErrorLimiteExcedido(42);

    expect(error).toMatchObject({
      tipo: 'LIMITE_EXCEDIDO',
      codigo: 'LIMITE_EXCEDIDO',
      reintentarEnSegundos: 42,
    });
    expect(error.message).toContain('42 s');
  });
});

describe('aErrorDeAplicacion', () => {
  class ErrorYaHecho extends ErrorDeDominio {
    constructor() {
      super('YA_HECHO', 'ya estaba hecho');
    }
  }

  it('traduce un error de dominio previsto conservando código y mensaje', () => {
    const traducido = aErrorDeAplicacion(new ErrorYaHecho(), { YA_HECHO: 'CONFLICTO' });

    expect(traducido).toBeInstanceOf(ErrorDeAplicacion);
    expect(traducido).toMatchObject({
      tipo: 'CONFLICTO',
      codigo: 'YA_HECHO',
      message: 'ya estaba hecho',
    });
  });

  it('devuelve tal cual un error de dominio no previsto o un error cualquiera', () => {
    const deDominio = new ErrorYaHecho();
    const otro = new TypeError('x');

    expect(aErrorDeAplicacion(deDominio, { OTRO: 'CONFLICTO' })).toBe(deDominio);
    expect(aErrorDeAplicacion(otro, { YA_HECHO: 'CONFLICTO' })).toBe(otro);
  });
});
