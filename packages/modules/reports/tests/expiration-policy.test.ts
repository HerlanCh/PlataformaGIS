import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CATEGORIAS_MVP } from '../domain/category.js';
import {
  FRACCION_DE_EXTENSION,
  PoliticaDeCaducidad,
  MAX_EXTENSIONES,
} from '../domain/expiration-policy.js';

const creado = new Date('2026-10-11T12:00:00Z');
const minutosDespues = (minutos: number) => new Date(creado.getTime() + minutos * 60_000);

const fecha = fc.date({
  min: new Date('2026-01-01T00:00:00Z'),
  max: new Date('2030-01-01T00:00:00Z'),
  noInvalidDate: true,
});
const ttl = fc.integer({ min: 1, max: 7 * 24 * 60 });

describe('PoliticaDeCaducidad', () => {
  it.each(CATEGORIAS_MVP.map((c) => [c.nombre, c.ttlMinutos] as const))(
    'HU-04: un reporte de "%s" caduca a los %i minutos',
    (_nombre, ttlMinutos) => {
      expect(PoliticaDeCaducidad.caducidadInicial(creado, ttlMinutos)).toEqual(
        minutosDespues(ttlMinutos),
      );
    },
  );

  it('HU-03: una extensión añade el 50 % del TTL original', () => {
    const caducidad = PoliticaDeCaducidad.caducidadInicial(creado, 180);

    expect(PoliticaDeCaducidad.extender(caducidad, 180)).toEqual(minutosDespues(270));
  });

  it('HU-04: caduca cuando la fecha de caducidad ya pasó', () => {
    const caducidad = minutosDespues(180);

    expect(PoliticaDeCaducidad.haCaducado(caducidad, minutosDespues(181))).toBe(true);
  });

  it('HU-04: no caduca antes de tiempo ni en el instante exacto', () => {
    const caducidad = minutosDespues(180);

    expect(PoliticaDeCaducidad.haCaducado(caducidad, minutosDespues(179))).toBe(false);
    expect(PoliticaDeCaducidad.haCaducado(caducidad, minutosDespues(180))).toBe(false);
  });

  it('propiedad: la caducidad nunca es anterior a la creación', () => {
    fc.assert(
      fc.property(fecha, ttl, (creacion, ttlMinutos) => {
        const caducidad = PoliticaDeCaducidad.caducidadInicial(creacion, ttlMinutos);

        expect(caducidad.getTime()).toBeGreaterThan(creacion.getTime());
      }),
    );
  });

  it('propiedad: con todas las extensiones la vida total es el doble del TTL', () => {
    fc.assert(
      fc.property(fecha, ttl, (creacion, ttlMinutos) => {
        let caducidad = PoliticaDeCaducidad.caducidadInicial(creacion, ttlMinutos);
        for (let i = 0; i < MAX_EXTENSIONES; i += 1) {
          caducidad = PoliticaDeCaducidad.extender(caducidad, ttlMinutos);
        }

        const vidaEnMinutos = (caducidad.getTime() - creacion.getTime()) / 60_000;
        expect(vidaEnMinutos).toBe(ttlMinutos * (1 + MAX_EXTENSIONES * FRACCION_DE_EXTENSION));
        expect(vidaEnMinutos).toBe(ttlMinutos * 2);
      }),
    );
  });

  it('propiedad: un reporte recién creado nunca está caducado', () => {
    fc.assert(
      fc.property(fecha, ttl, (creacion, ttlMinutos) => {
        const caducidad = PoliticaDeCaducidad.caducidadInicial(creacion, ttlMinutos);

        expect(PoliticaDeCaducidad.haCaducado(caducidad, creacion)).toBe(false);
      }),
    );
  });
});
