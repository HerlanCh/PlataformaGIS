import { codigoCategoria } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { Categoria, ErrorCategoriaInvalida, CATEGORIAS_MVP } from '../domain/category.js';

const valida = {
  codigo: codigoCategoria('bloqueo'),
  nombre: 'Bloqueo',
  ttlMinutos: 360,
  radioDuplicadoM: 100,
  esSensible: false,
};

describe('Categoria', () => {
  it('se crea con sus parámetros y recorta el nombre', () => {
    expect(Categoria.crear({ ...valida, nombre: '  Bloqueo  ' })).toMatchObject(valida);
  });

  it.each([
    ['un nombre vacío', { nombre: '   ' }],
    ['un TTL de cero', { ttlMinutos: 0 }],
    ['un TTL negativo', { ttlMinutos: -5 }],
    ['un TTL con decimales', { ttlMinutos: 1.5 }],
    ['un radio de cero', { radioDuplicadoM: 0 }],
    ['un radio con decimales', { radioDuplicadoM: 50.5 }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(() => Categoria.crear({ ...valida, ...cambio })).toThrow(ErrorCategoriaInvalida);
  });

  it('es inmutable', () => {
    const categoria = Categoria.crear(valida);

    expect(() => {
      (categoria as { ttlMinutos: number }).ttlMinutos = 1;
    }).toThrow(TypeError);
  });

  it('el catálogo del MVP coincide con la tabla del SRS 3.1', () => {
    const tabla = CATEGORIAS_MVP.map((c) => [
      c.codigo,
      c.ttlMinutos,
      c.radioDuplicadoM,
      c.esSensible,
    ]);

    expect(tabla).toEqual([
      ['bloqueo', 360, 100, false],
      ['accidente', 180, 50, false],
      ['robo', 120, 200, true],
      ['infraestructura', 1440, 50, false],
      ['jauria', 120, 150, false],
    ]);
  });
});
