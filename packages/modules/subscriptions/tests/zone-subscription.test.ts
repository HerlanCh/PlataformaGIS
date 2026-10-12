import { ErrorIdentificadorInvalido } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { ErrorRadioInvalido, ErrorSinCategorias } from '../domain/errors.js';
import { idSuscripcion, ZonaSuscrita } from '../domain/zone-subscription.js';
import { ahora, ana, bloqueo, idZona, plazaMurillo, robo, zona } from './fixtures.js';

describe('ZonaSuscrita', () => {
  it('HU-07: crea una zona con centro, radio de 800 m y categorías', () => {
    expect(zona()).toMatchObject({
      id: idZona(1),
      idUsuario: ana,
      centro: plazaMurillo,
      radioM: 800,
      categorias: [bloqueo, robo],
      creadoEn: ahora,
    });
  });

  it.each([100, 2000])('HU-07: acepta el radio límite de %d m', (radioM) => {
    expect(zona({ radioM }).radioM).toBe(radioM);
  });

  it.each([99, 2001, 2500, 0, -800, 800.5, Number.NaN])(
    'HU-07: rechaza un radio de %d m',
    (radioM) => {
      expect(() => zona({ radioM })).toThrow(ErrorRadioInvalido);
    },
  );

  it('HU-07: el rechazo indica el máximo de 2000 m', () => {
    expect(() => zona({ radioM: 2500 })).toThrow(/2000 m/);
  });

  it('HU-07: rechaza una zona sin categorías', () => {
    expect(() => zona({ categorias: [] })).toThrow(ErrorSinCategorias);
  });

  it('guarda una sola vez las categorías repetidas', () => {
    expect(zona({ categorias: [robo, bloqueo, robo] }).categorias).toEqual([robo, bloqueo]);
  });

  it('es inmutable', () => {
    const creada = zona();

    expect(Object.isFrozen(creada)).toBe(true);
    expect(Object.isFrozen(creada.categorias)).toBe(true);
  });

  it('se reconstruye desde sus datos guardados', () => {
    const creada = zona();

    expect(ZonaSuscrita.restaurar({ ...creada })).toEqual(creada);
  });

  it('el identificador de una zona debe ser un UUID', () => {
    expect(() => idSuscripcion('zona-1')).toThrow(ErrorIdentificadorInvalido);
  });
});
