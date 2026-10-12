import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { definirEvento, claveDeEvento } from './index.js';

const pruebaV1 = definirEvento('Prueba', 1, 'interno', z.object({ mensaje: z.string() }));

const evento = {
  id: '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f',
  tipo: 'Prueba',
  version: 1,
  ocurridoEn: '2026-10-11T12:00:00Z',
  contenido: { mensaje: 'hola' },
};

describe('contracts: eventos de integración', () => {
  it('la clave de un evento combina tipo y versión', () => {
    expect(claveDeEvento({ tipo: 'ReporteCreado', version: 1 })).toBe('ReporteCreado.v1');
    expect(pruebaV1.clave).toBe('Prueba.v1');
  });

  it('acepta un evento que cumple el contrato', () => {
    expect(pruebaV1.esquema.parse(evento)).toEqual(evento);
  });

  it('rechaza otra versión o una carga inválida', () => {
    expect(pruebaV1.esquema.safeParse({ ...evento, version: 2 }).success).toBe(false);
    expect(pruebaV1.esquema.safeParse({ ...evento, contenido: {} }).success).toBe(false);
  });
});
