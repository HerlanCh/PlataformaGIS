import { GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import { ConsultarVistas } from '../application/consultar-vistas.js';
import {
  CongelarInstantanea,
  ListarInstantaneas,
  ObtenerInstantanea,
} from '../application/instantaneas.js';
import { InstantaneasEnMemoria, RegistroEnMemoria } from './dobles.js';

const ID = '6f1c2f0e-3b7a-4d2a-9c58-000000000001';
const reloj = new RelojFijo('2026-11-22T12:00:00.000Z');
const hace = (minutos: number) => new Date(reloj.ahora().getTime() - minutos * 60_000);
const caja = { latitudMin: -16.51, latitudMax: -16.49, longitudMin: -68.16, longitudMax: -68.14 };

async function escenario() {
  const registro = new RegistroEnMemoria();
  const instantaneas = new InstantaneasEnMemoria();
  await registro.registrarEnvio({
    idEnvio: ID,
    tipo: 'CREADO',
    idReporte: ID,
    codigoCategoria: 'bloqueo',
    publicLocation: { latitud: -16.5, longitud: -68.15 },
    fuenteOficial: null,
    recibidoEn: hace(60),
  });
  await registro.registrarTransicion({
    idEvento: '6f1c2f0e-3b7a-4d2a-9c58-000000000101',
    idReporte: ID,
    estado: 'ACTIVO',
    caducaEn: hace(-300),
    ocurridoEn: hace(60),
  });
  const deps = { registro, instantaneas, reloj, ids: new GeneradorDeIdSecuencial('aaaaaaaa') };
  return {
    instantaneas,
    vistas: new ConsultarVistas(registro, reloj),
    congelar: new CongelarInstantanea(deps),
    listar: new ListarInstantaneas(instantaneas),
    obtener: new ObtenerInstantanea(instantaneas),
  };
}

const MODERADOR = 'MODERADOR' as const;

describe('instrumentos de vistas e instantáneas (ADR-007)', () => {
  it('HU-14: un ciudadano no puede consultar vistas ni usar instantáneas', async () => {
    const { vistas, congelar, listar, obtener } = await escenario();
    const rolActor = 'CIUDADANO' as const;
    const instante = hace(0).toISOString();

    for (const intento of [
      vistas.ejecutar({ rolActor, instante, caja }),
      congelar.ejecutar({ rolActor, nombre: 'E1', instante, caja }),
      listar.ejecutar({ rolActor }),
      obtener.ejecutar({ rolActor, id: ID }),
    ]) {
      await expect(intento).rejects.toMatchObject({
        tipo: 'PROHIBIDO',
        codigo: 'ROL_INSUFICIENTE',
      });
    }
  });

  it('HU-14: reconstruye las vistas de un instante pasado y rechaza uno futuro o una zona invertida', async () => {
    const { vistas } = await escenario();

    const ahora = await vistas.ejecutar({ rolActor: MODERADOR, instante: hace(0), caja });

    expect(ahora.procesada.map((p) => p.idReporte)).toEqual([ID]);
    expect(ahora.base.map((p) => p.idEnvio)).toEqual([ID]);
    await expect(
      vistas.ejecutar({ rolActor: MODERADOR, instante: hace(-1).toISOString(), caja }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA', codigo: 'INSTANTE_FUTURO' });
    await expect(
      vistas.ejecutar({
        rolActor: MODERADOR,
        instante: hace(0),
        caja: { ...caja, latitudMin: caja.latitudMax },
      }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA' });
  });

  it('HU-14: congela ambas vistas con su nombre y no admite dos con el mismo', async () => {
    const { congelar, instantaneas } = await escenario();

    const e1 = await congelar.ejecutar({
      rolActor: MODERADOR,
      nombre: '  E1 ',
      instante: hace(30).toISOString(),
      caja,
    });

    expect(e1).toMatchObject({ nombre: 'E1', instante: hace(30), creadaEn: reloj.ahora(), caja });
    expect([e1.procesada.length, e1.base.length]).toEqual([1, 1]);
    expect(instantaneas.guardadas.get(e1.id)).toEqual(e1);
    await expect(
      congelar.ejecutar({ rolActor: MODERADOR, nombre: 'E1', instante: hace(10), caja }),
    ).rejects.toMatchObject({ tipo: 'CONFLICTO', codigo: 'NOMBRE_REPETIDO' });
    await expect(
      congelar.ejecutar({ rolActor: MODERADOR, nombre: 'E2', instante: hace(-5), caja }),
    ).rejects.toMatchObject({ codigo: 'INSTANTE_FUTURO' });
  });

  it('HU-14: lista las instantáneas con sus conteos y entrega una con sus puntos', async () => {
    const { congelar, listar, obtener } = await escenario();
    const e1 = await congelar.ejecutar({
      rolActor: MODERADOR,
      nombre: 'E1',
      instante: hace(90),
      caja,
    });

    const lista = await listar.ejecutar({ rolActor: MODERADOR });
    const completa = await obtener.ejecutar({ rolActor: MODERADOR, id: e1.id });

    // Hace 90 minutos el reporte aún no existía: la instantánea está vacía.
    expect(lista).toEqual([
      expect.objectContaining({ id: e1.id, nombre: 'E1', puntosProcesada: 0, puntosBase: 0 }),
    ]);
    expect(completa).toEqual(e1);
    await expect(obtener.ejecutar({ rolActor: MODERADOR, id: ID })).rejects.toMatchObject({
      tipo: 'NO_ENCONTRADO',
      codigo: 'INSTANTANEA_NO_ENCONTRADA',
    });
  });
});
