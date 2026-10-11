import { describe, expect, it } from 'vitest';
import { DomainError, DomainEvent, err, ok } from './index.js';

class EventoDePrueba extends DomainEvent {
  readonly type = 'Prueba';
  readonly version = 1;
}

class ErrorDePrueba extends DomainError {
  constructor() {
    super('PRUEBA', 'mensaje de prueba');
  }
}

describe('shared-kernel', () => {
  it('Result distingue el éxito del fallo', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
    expect(err('falló')).toEqual({ ok: false, error: 'falló' });
  });

  it('DomainEvent conserva id, tipo, versión y fecha', () => {
    const occurredAt = new Date('2026-10-11T12:00:00Z');
    const evento = new EventoDePrueba({ id: 'e-1', occurredAt });

    expect(evento).toMatchObject({ id: 'e-1', type: 'Prueba', version: 1, occurredAt });
  });

  it('DomainError expone un código estable y el nombre de la subclase', () => {
    const error = new ErrorDePrueba();

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code: 'PRUEBA', name: 'ErrorDePrueba' });
  });
});
