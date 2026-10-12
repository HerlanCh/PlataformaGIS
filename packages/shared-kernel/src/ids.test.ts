import { describe, expect, it } from 'vitest';
import { codigoCategoria, ErrorIdentificadorInvalido, idReporte, idUsuario } from './index.js';

const UUID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';

describe('identificadores tipados', () => {
  it('aceptan un UUID', () => {
    expect(idReporte(UUID)).toBe(UUID);
    expect(idUsuario(UUID.toUpperCase())).toBe(UUID.toUpperCase());
  });

  it.each(['', '123', 'no-es-un-uuid', `${UUID}0`])('rechazan "%s" como UUID', (valor) => {
    expect(() => idReporte(valor)).toThrow(ErrorIdentificadorInvalido);
    expect(() => idUsuario(valor)).toThrow(ErrorIdentificadorInvalido);
  });

  it.each(['bloqueo', 'accidente', 'via_danada', 'tipo2'])(
    'aceptan "%s" como código de categoría',
    (valor) => {
      expect(codigoCategoria(valor)).toBe(valor);
    },
  );

  it.each(['', 'Bloqueo', '2tipo', 'con espacio', 'con-guion'])(
    'rechazan "%s" como código de categoría',
    (valor) => {
      expect(() => codigoCategoria(valor)).toThrow(ErrorIdentificadorInvalido);
    },
  );

  it('el error indica qué valor y qué tipo fallaron', () => {
    expect(() => idReporte('abc')).toThrow('"abc" no es un IdReporte válido');
  });
});
