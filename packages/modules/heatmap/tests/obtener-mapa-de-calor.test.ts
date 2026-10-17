import { describe, expect, it } from 'vitest';
import {
  MAX_DIAS_POR_CONSULTA,
  ObtenerMapaDeCalor,
  TAMANO_CELDA_POR_DEFECTO_M,
} from '../application/obtener-mapa-de-calor.js';
import { UMBRAL_ANONIMATO } from '../domain/consulta-de-calor.js';
import type {
  CeldaDeCalor,
  ConsultaDeCalor,
  ConsultaDeMapaDeCalor,
} from '../domain/consulta-de-calor.js';

/** Agrega en memoria puntos ya asignados a su celda y aplica el umbral, como el adaptador. */
class ConsultaFalsa implements ConsultaDeMapaDeCalor {
  readonly recibidas: ConsultaDeCalor[] = [];

  constructor(private readonly conteos: readonly CeldaDeCalor[]) {}

  agregar(consulta: ConsultaDeCalor): Promise<readonly CeldaDeCalor[]> {
    this.recibidas.push(consulta);
    return Promise.resolve(this.conteos.filter((celda) => celda.cantidad >= UMBRAL_ANONIMATO));
  }
}

const entrada = {
  latitudMin: -16.52,
  latitudMax: -16.48,
  longitudMin: -68.17,
  longitudMax: -68.13,
  desde: '2026-10-01T00:00:00Z',
  hasta: '2026-10-12T00:00:00Z',
};

describe('ObtenerMapaDeCalor', () => {
  it('HU-06: una celda con 2 reportes no aparece; una con 3 aparece con su conteo', async () => {
    const consulta = new ConsultaFalsa([
      { latitud: -16.5, longitud: -68.15, cantidad: 2 },
      { latitud: -16.49, longitud: -68.14, cantidad: 3 },
    ]);

    const celdas = await new ObtenerMapaDeCalor(consulta).ejecutar(entrada);

    expect(celdas).toEqual([{ latitud: -16.49, longitud: -68.14, cantidad: 3 }]);
  });

  it('usa celdas de 250 m y todas las categorías por defecto', async () => {
    const consulta = new ConsultaFalsa([]);

    await new ObtenerMapaDeCalor(consulta).ejecutar(entrada);

    expect(consulta.recibidas[0]).toMatchObject({
      tamanoCeldaM: TAMANO_CELDA_POR_DEFECTO_M,
      categorias: [],
      desde: new Date(entrada.desde),
      hasta: new Date(entrada.hasta),
      caja: { latitudMin: -16.52, latitudMax: -16.48, longitudMin: -68.17, longitudMax: -68.13 },
    });
  });

  it(`rechaza un rango de más de ${MAX_DIAS_POR_CONSULTA} días`, async () => {
    const consulta = new ConsultaFalsa([]);

    await expect(
      new ObtenerMapaDeCalor(consulta).ejecutar({ ...entrada, desde: '2026-01-01T00:00:00Z' }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA', codigo: 'RANGO_DEMASIADO_AMPLIO' });
    expect(consulta.recibidas).toEqual([]);
  });

  it.each([
    ['una celda menor de 100 m', { tamanoCeldaM: 50 }, 'CONSULTA_DE_CALOR_INVALIDA'],
    [
      'un rango invertido',
      { desde: entrada.hasta, hasta: entrada.desde },
      'CONSULTA_DE_CALOR_INVALIDA',
    ],
    ['una fecha que no es fecha', { desde: 'ayer' }, 'ENTRADA_INVALIDA'],
  ])('rechaza %s', async (_caso, cambio, codigo) => {
    await expect(
      new ObtenerMapaDeCalor(new ConsultaFalsa([])).ejecutar({ ...entrada, ...cambio }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA', codigo });
  });
});
