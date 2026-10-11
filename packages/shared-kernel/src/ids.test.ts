import { describe, expect, it } from 'vitest';
import { categoryCode, InvalidIdentifierError, reportId, userId } from './index.js';

const UUID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';

describe('identificadores tipados', () => {
  it('aceptan un UUID', () => {
    expect(reportId(UUID)).toBe(UUID);
    expect(userId(UUID.toUpperCase())).toBe(UUID.toUpperCase());
  });

  it.each(['', '123', 'no-es-un-uuid', `${UUID}0`])('rechazan "%s" como UUID', (valor) => {
    expect(() => reportId(valor)).toThrow(InvalidIdentifierError);
    expect(() => userId(valor)).toThrow(InvalidIdentifierError);
  });

  it.each(['bloqueo', 'accidente', 'via_danada', 'tipo2'])(
    'aceptan "%s" como código de categoría',
    (valor) => {
      expect(categoryCode(valor)).toBe(valor);
    },
  );

  it.each(['', 'Bloqueo', '2tipo', 'con espacio', 'con-guion'])(
    'rechazan "%s" como código de categoría',
    (valor) => {
      expect(() => categoryCode(valor)).toThrow(InvalidIdentifierError);
    },
  );

  it('el error indica qué valor y qué tipo fallaron', () => {
    expect(() => reportId('abc')).toThrow('"abc" no es un ReportId válido');
  });
});
