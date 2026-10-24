import type { Db } from '@gis/platform';
import { RelojFijo } from '@gis/testing';
import { describe, expect, it, vi } from 'vitest';
import { cargarConfigHttp } from '../http/config-http.js';
import { componerMetricas, conActividad } from './metricas.js';

const ANA = '11111111-1111-4111-8111-111111111111';
const HUMO = '99999999-9999-4999-8999-999999999999';

/** Base falsa: anota cada sentencia que se ejecuta, o falla si se pide. */
function baseFalsa(falla = false) {
  const sentencias: string[] = [];
  const ejecutar = vi.fn(() => (falla ? Promise.reject(new Error('sin base')) : Promise.resolve()));
  const db = {
    insert: () => ({
      values: () => ({ onConflictDoNothing: () => (sentencias.push('insert'), ejecutar()) }),
    }),
    execute: () => (sentencias.push('consolidar'), ejecutar()),
  } as unknown as Db;
  return { db, sentencias };
}

describe('métricas en la raíz de composición (Fase 13)', () => {
  it('anota a quien ejecutó el caso con éxito, y no si falló', async () => {
    const anotar = vi.fn(() => Promise.resolve());
    const exito = conActividad(
      { ejecutar: (e: { id: string }) => Promise.resolve(e.id) },
      (e) => e.id,
      anotar,
    );
    const fallo = conActividad(
      { ejecutar: () => Promise.reject(new Error('límite')) },
      () => ANA,
      anotar,
    );

    expect(await exito.ejecutar({ id: ANA })).toBe(ANA);
    await expect(fallo.ejecutar({})).rejects.toThrow('límite');
    expect(anotar).toHaveBeenCalledTimes(1);
    expect(anotar).toHaveBeenCalledWith(ANA);
  });

  it('registra la huella del día y consolida los días anteriores', async () => {
    const { db, sentencias } = baseFalsa();

    await componerMetricas(db, new RelojFijo(), 'sal', HUMO).anotar(ANA);

    expect(sentencias).toEqual(['insert', 'consolidar']);
  });

  it('el usuario de humo no cuenta como activo', async () => {
    const { db, sentencias } = baseFalsa();

    await componerMetricas(db, new RelojFijo(), 'sal', HUMO).anotar(HUMO);

    expect(sentencias).toEqual([]);
  });

  it('un fallo de las métricas no hace fallar el reporte o el voto', async () => {
    const { db } = baseFalsa(true);

    await expect(
      componerMetricas(db, new RelojFijo(), 'sal', null).anotar(ANA),
    ).resolves.toBeUndefined();
  });

  it('la sal se toma de METRICAS_SAL o se deriva de JWT_SECRET, sin ser igual a él', () => {
    const secreto = 'a'.repeat(32);
    const propia = 'b'.repeat(32);

    const derivada = cargarConfigHttp({ JWT_SECRET: secreto }).salDeMetricas;

    expect(derivada).toMatch(/^[0-9a-f]{64}$/);
    expect(derivada).not.toBe(secreto);
    expect(cargarConfigHttp({ JWT_SECRET: secreto }).salDeMetricas).toBe(derivada);
    expect(cargarConfigHttp({ JWT_SECRET: secreto, METRICAS_SAL: propia }).salDeMetricas).toBe(
      propia,
    );
  });
});
