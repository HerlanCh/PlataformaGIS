import { categoryCode } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { Category, InvalidCategoryError, MVP_CATEGORIES } from '../domain/category.js';

const valida = {
  code: categoryCode('bloqueo'),
  name: 'Bloqueo',
  ttlMinutes: 360,
  dedupRadiusM: 100,
  isSensitive: false,
};

describe('Category', () => {
  it('se crea con sus parámetros y recorta el nombre', () => {
    expect(Category.create({ ...valida, name: '  Bloqueo  ' })).toMatchObject(valida);
  });

  it.each([
    ['un nombre vacío', { name: '   ' }],
    ['un TTL de cero', { ttlMinutes: 0 }],
    ['un TTL negativo', { ttlMinutes: -5 }],
    ['un TTL con decimales', { ttlMinutes: 1.5 }],
    ['un radio de cero', { dedupRadiusM: 0 }],
    ['un radio con decimales', { dedupRadiusM: 50.5 }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(() => Category.create({ ...valida, ...cambio })).toThrow(InvalidCategoryError);
  });

  it('es inmutable', () => {
    const categoria = Category.create(valida);

    expect(() => {
      (categoria as { ttlMinutes: number }).ttlMinutes = 1;
    }).toThrow(TypeError);
  });

  it('el catálogo del MVP coincide con la tabla del SRS 3.1', () => {
    const tabla = MVP_CATEGORIES.map((c) => [c.code, c.ttlMinutes, c.dedupRadiusM, c.isSensitive]);

    expect(tabla).toEqual([
      ['bloqueo', 360, 100, false],
      ['accidente', 180, 50, false],
      ['robo', 120, 200, true],
      ['infraestructura', 1440, 50, false],
      ['jauria', 120, 150, false],
    ]);
  });
});
