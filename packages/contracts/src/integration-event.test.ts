import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineEvent, eventKey } from './index.js';

const pruebaV1 = defineEvent('Prueba', 1, z.object({ mensaje: z.string() }));

const evento = {
  id: '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f',
  type: 'Prueba',
  version: 1,
  occurredAt: '2026-10-11T12:00:00Z',
  payload: { mensaje: 'hola' },
};

describe('contracts: eventos de integración', () => {
  it('la clave de un evento combina tipo y versión', () => {
    expect(eventKey({ type: 'ReportCreated', version: 1 })).toBe('ReportCreated.v1');
    expect(pruebaV1.key).toBe('Prueba.v1');
  });

  it('acepta un evento que cumple el contrato', () => {
    expect(pruebaV1.schema.parse(evento)).toEqual(evento);
  });

  it('rechaza otra versión o una carga inválida', () => {
    expect(pruebaV1.schema.safeParse({ ...evento, version: 2 }).success).toBe(false);
    expect(pruebaV1.schema.safeParse({ ...evento, payload: {} }).success).toBe(false);
  });
});
