import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MVP_CATEGORIES } from '../domain/category.js';
import {
  EXTENSION_FRACTION,
  ExpirationPolicy,
  MAX_EXTENSIONS,
} from '../domain/expiration-policy.js';

const creado = new Date('2026-10-11T12:00:00Z');
const minutosDespues = (minutos: number) => new Date(creado.getTime() + minutos * 60_000);

const fecha = fc.date({
  min: new Date('2026-01-01T00:00:00Z'),
  max: new Date('2030-01-01T00:00:00Z'),
  noInvalidDate: true,
});
const ttl = fc.integer({ min: 1, max: 7 * 24 * 60 });

describe('ExpirationPolicy', () => {
  it.each(MVP_CATEGORIES.map((c) => [c.name, c.ttlMinutes] as const))(
    'HU-04: un reporte de "%s" caduca a los %i minutos',
    (_nombre, ttlMinutes) => {
      expect(ExpirationPolicy.initialExpiration(creado, ttlMinutes)).toEqual(
        minutosDespues(ttlMinutes),
      );
    },
  );

  it('HU-03: una extensión añade el 50 % del TTL original', () => {
    const caducidad = ExpirationPolicy.initialExpiration(creado, 180);

    expect(ExpirationPolicy.extend(caducidad, 180)).toEqual(minutosDespues(270));
  });

  it('HU-04: caduca cuando la fecha de caducidad ya pasó', () => {
    const caducidad = minutosDespues(180);

    expect(ExpirationPolicy.isExpired(caducidad, minutosDespues(181))).toBe(true);
  });

  it('HU-04: no caduca antes de tiempo ni en el instante exacto', () => {
    const caducidad = minutosDespues(180);

    expect(ExpirationPolicy.isExpired(caducidad, minutosDespues(179))).toBe(false);
    expect(ExpirationPolicy.isExpired(caducidad, minutosDespues(180))).toBe(false);
  });

  it('propiedad: la caducidad nunca es anterior a la creación', () => {
    fc.assert(
      fc.property(fecha, ttl, (creacion, ttlMinutes) => {
        const caducidad = ExpirationPolicy.initialExpiration(creacion, ttlMinutes);

        expect(caducidad.getTime()).toBeGreaterThan(creacion.getTime());
      }),
    );
  });

  it('propiedad: con todas las extensiones la vida total es el doble del TTL', () => {
    fc.assert(
      fc.property(fecha, ttl, (creacion, ttlMinutes) => {
        let caducidad = ExpirationPolicy.initialExpiration(creacion, ttlMinutes);
        for (let i = 0; i < MAX_EXTENSIONS; i += 1) {
          caducidad = ExpirationPolicy.extend(caducidad, ttlMinutes);
        }

        const vidaEnMinutos = (caducidad.getTime() - creacion.getTime()) / 60_000;
        expect(vidaEnMinutos).toBe(ttlMinutes * (1 + MAX_EXTENSIONS * EXTENSION_FRACTION));
        expect(vidaEnMinutos).toBe(ttlMinutes * 2);
      }),
    );
  });

  it('propiedad: un reporte recién creado nunca está caducado', () => {
    fc.assert(
      fc.property(fecha, ttl, (creacion, ttlMinutes) => {
        const caducidad = ExpirationPolicy.initialExpiration(creacion, ttlMinutes);

        expect(ExpirationPolicy.isExpired(caducidad, creacion)).toBe(false);
      }),
    );
  });
});
