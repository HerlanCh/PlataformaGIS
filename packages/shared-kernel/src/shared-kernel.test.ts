import { describe, expect, it } from 'vitest';
import { ErrorDeDominio, EventoDeDominio, fallo, exito } from './index.js';

class EventoDePrueba extends EventoDeDominio {
  readonly tipo = 'Prueba';
  readonly version = 1;
}

class ErrorDePrueba extends ErrorDeDominio {
  constructor() {
    super('PRUEBA', 'mensaje de prueba');
  }
}

describe('shared-kernel', () => {
  it('Result distingue el éxito del fallo', () => {
    expect(exito(3)).toEqual({ exitoso: true, valor: 3 });
    expect(fallo('falló')).toEqual({ exitoso: false, error: 'falló' });
  });

  it('EventoDeDominio conserva id, tipo, versión y fecha', () => {
    const ocurridoEn = new Date('2026-10-11T12:00:00Z');
    const evento = new EventoDePrueba({ id: 'e-1', ocurridoEn });

    expect(evento).toMatchObject({ id: 'e-1', tipo: 'Prueba', version: 1, ocurridoEn });
  });

  it('ErrorDeDominio expone un código estable y el nombre de la subclase', () => {
    const error = new ErrorDePrueba();

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ codigo: 'PRUEBA', name: 'ErrorDePrueba' });
  });
});
