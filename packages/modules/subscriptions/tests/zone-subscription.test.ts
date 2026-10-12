import { InvalidIdentifierError } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { InvalidRadiusError, NoCategoriesError } from '../domain/errors.js';
import { subscriptionId, ZoneSubscription } from '../domain/zone-subscription.js';
import { ahora, ana, bloqueo, idZona, plazaMurillo, robo, zona } from './fixtures.js';

describe('ZoneSubscription', () => {
  it('HU-07: crea una zona con centro, radio de 800 m y categorías', () => {
    expect(zona()).toMatchObject({
      id: idZona(1),
      userId: ana,
      center: plazaMurillo,
      radiusM: 800,
      categories: [bloqueo, robo],
      createdAt: ahora,
    });
  });

  it.each([100, 2000])('HU-07: acepta el radio límite de %d m', (radiusM) => {
    expect(zona({ radiusM }).radiusM).toBe(radiusM);
  });

  it.each([99, 2001, 2500, 0, -800, 800.5, Number.NaN])(
    'HU-07: rechaza un radio de %d m',
    (radiusM) => {
      expect(() => zona({ radiusM })).toThrow(InvalidRadiusError);
    },
  );

  it('HU-07: el rechazo indica el máximo de 2000 m', () => {
    expect(() => zona({ radiusM: 2500 })).toThrow(/2000 m/);
  });

  it('HU-07: rechaza una zona sin categorías', () => {
    expect(() => zona({ categories: [] })).toThrow(NoCategoriesError);
  });

  it('guarda una sola vez las categorías repetidas', () => {
    expect(zona({ categories: [robo, bloqueo, robo] }).categories).toEqual([robo, bloqueo]);
  });

  it('es inmutable', () => {
    const creada = zona();

    expect(Object.isFrozen(creada)).toBe(true);
    expect(Object.isFrozen(creada.categories)).toBe(true);
  });

  it('se reconstruye desde sus datos guardados', () => {
    const creada = zona();

    expect(ZoneSubscription.restore({ ...creada })).toEqual(creada);
  });

  it('el identificador de una zona debe ser un UUID', () => {
    expect(() => subscriptionId('zona-1')).toThrow(InvalidIdentifierError);
  });
});
