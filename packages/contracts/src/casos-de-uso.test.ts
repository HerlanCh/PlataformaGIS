import { ErrorValidacionFallida } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  crearEvento,
  leerContenido,
  reporteCaducadoV1,
  reporteConfirmadoV1,
  validarEntrada,
} from './index.js';

const ID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';
const sobre = { id: ID, ocurridoEn: new Date('2026-10-11T12:00:00Z') };

describe('crearEvento', () => {
  it('arma el sobre con la clave de la definición y la fecha en ISO', () => {
    const evento = crearEvento(reporteCaducadoV1, { idReporte: ID }, sobre);

    expect(evento).toEqual({
      id: ID,
      tipo: 'ReporteCaducado',
      version: 1,
      ocurridoEn: '2026-10-11T12:00:00.000Z',
      contenido: { idReporte: ID },
    });
  });

  it('rechaza un contenido que no cumple el contrato o un id que no es UUID', () => {
    expect(() => crearEvento(reporteCaducadoV1, { idReporte: 'x' }, sobre)).toThrow();
    expect(() =>
      crearEvento(reporteCaducadoV1, { idReporte: ID }, { ...sobre, id: 'x' }),
    ).toThrow();
  });
});

describe('leerContenido', () => {
  it('devuelve el contenido tipado de un evento de esa definición', () => {
    const evento = crearEvento(reporteCaducadoV1, { idReporte: ID }, sobre);

    expect(leerContenido(reporteCaducadoV1, evento)).toEqual({ idReporte: ID });
  });

  it('rechaza un evento de otra definición', () => {
    const evento = crearEvento(reporteCaducadoV1, { idReporte: ID }, sobre);

    expect(() => leerContenido(reporteConfirmadoV1, evento)).toThrow(
      'Se esperaba ReporteConfirmado.v1 y llegó ReporteCaducado.v1',
    );
  });
});

describe('validarEntrada', () => {
  const esquema = z.object({ nombre: z.string().min(1) });

  it('devuelve la entrada ya validada', () => {
    expect(validarEntrada(esquema, { nombre: 'a' })).toEqual({ nombre: 'a' });
  });

  it('lanza un error de validación con el detalle del campo', () => {
    const fallo = () => validarEntrada(esquema, { nombre: '' });

    expect(fallo).toThrow(ErrorValidacionFallida);
    expect(fallo).toThrow(/nombre/);
  });
});
