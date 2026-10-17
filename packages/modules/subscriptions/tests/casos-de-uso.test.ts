import { crearEvento, reporteCreadoV1 } from '@gis/contracts';
import type { CodigoCategoria, IdReporte, IdUsuario, PuntoGeo } from '@gis/shared-kernel';
import { desplazar, GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import { EliminarZona } from '../application/eliminar-zona.js';
import { NotificarSuscriptores } from '../application/notificar-suscriptores.js';
import type { AvisoDeReporte } from '../application/ports.js';
import { MAX_ZONAS_POR_USUARIO, SuscribirZona } from '../application/suscribir-zona.js';
import type { RepositorioDeSuscripciones } from '../domain/ports.js';
import type { IdSuscripcion, ZonaSuscrita } from '../domain/zone-subscription.js';
import { ana, beto, bloqueo, idZona, plazaMurillo, zona } from './fixtures.js';

/** Mismo contrato que `RepositorioSuscripcionesPg`, con distancias haversine. */
class SuscripcionesEnMemoria implements RepositorioDeSuscripciones {
  readonly filas = new Map<IdSuscripcion, ZonaSuscrita>();

  buscarPorId(id: IdSuscripcion): Promise<ZonaSuscrita | null> {
    return Promise.resolve(this.filas.get(id) ?? null);
  }

  buscarPorUsuario(idUsuario: IdUsuario): Promise<readonly ZonaSuscrita[]> {
    return Promise.resolve([...this.filas.values()].filter((z) => z.idUsuario === idUsuario));
  }

  guardar(zona: ZonaSuscrita): Promise<void> {
    this.filas.set(zona.id, zona);
    return Promise.resolve();
  }

  eliminar(id: IdSuscripcion): Promise<boolean> {
    return Promise.resolve(this.filas.delete(id));
  }

  buscarSuscriptores(
    punto: PuntoGeo,
    categoria: CodigoCategoria,
  ): Promise<readonly ZonaSuscrita[]> {
    return Promise.resolve(
      [...this.filas.values()].filter(
        (z) => z.categorias.includes(categoria) && z.centro.distanciaA(punto) <= z.radioM,
      ),
    );
  }
}

const ID_REPORTE = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f' as IdReporte;

function escenario(autor: IdUsuario | null = beto) {
  const suscripciones = new SuscripcionesEnMemoria();
  const avisos: AvisoDeReporte[] = [];
  const deps = {
    suscripciones,
    reloj: new RelojFijo(),
    ids: new GeneradorDeIdSecuencial('dddddddd'),
    consultaDeAutor: { autorDe: () => Promise.resolve(autor) },
    enviador: {
      enviar: (aviso: AvisoDeReporte) => {
        avisos.push(aviso);
        return Promise.resolve();
      },
    },
  };
  return { suscripciones, avisos, deps };
}

const nuevaZona = (radioM = 800, categorias = ['bloqueo'], idUsuario: string = ana) => ({
  idUsuario,
  latitud: plazaMurillo.latitud,
  longitud: plazaMurillo.longitud,
  radioM,
  categorias,
});

const reporteCreado = (punto: PuntoGeo, categoria = 'bloqueo') =>
  crearEvento(
    reporteCreadoV1,
    {
      idReporte: ID_REPORTE,
      codigoCategoria: categoria,
      publicLocation: { latitud: punto.latitud, longitud: punto.longitud },
      estado: 'ACTIVO',
      creadoEn: '2026-10-12T12:00:00.000Z',
      caducaEn: '2026-10-12T18:00:00.000Z',
    },
    { id: '00000000-0000-4000-8000-0000000000aa', ocurridoEn: new Date() },
  );

describe('SuscribirZona', () => {
  it('HU-07: guarda una zona con centro, radio de 800 m y categorías', async () => {
    const { deps, suscripciones } = escenario();

    const creada = await new SuscribirZona(deps).ejecutar(nuevaZona(800, ['bloqueo', 'robo']));

    expect(creada).toMatchObject({ idUsuario: ana, radioM: 800, categorias: ['bloqueo', 'robo'] });
    expect(suscripciones.filas.size).toBe(1);
  });

  it('HU-07: rechaza un radio de 2500 m indicando el máximo de 2000 m', async () => {
    const { deps, suscripciones } = escenario();

    const intento = new SuscribirZona(deps).ejecutar(nuevaZona(2500));

    await expect(intento).rejects.toMatchObject({
      tipo: 'VALIDACION_FALLIDA',
      codigo: 'RADIO_INVALIDO',
      message: expect.stringContaining('2000 m'),
    });
    expect(suscripciones.filas.size).toBe(0);
  });

  it('HU-07: con 5 zonas, la sexta se rechaza indicando el límite', async () => {
    const { deps } = escenario();
    const suscribir = new SuscribirZona(deps);
    for (let i = 0; i < MAX_ZONAS_POR_USUARIO; i += 1) await suscribir.ejecutar(nuevaZona());

    await expect(suscribir.ejecutar(nuevaZona())).rejects.toMatchObject({
      tipo: 'CONFLICTO',
      codigo: 'LIMITE_DE_ZONAS',
    });
    // El límite es por usuario.
    await expect(suscribir.ejecutar(nuevaZona(800, ['bloqueo'], beto))).resolves.toBeDefined();
  });

  it.each([
    ['sin categorías', { categorias: [] }, 'SIN_CATEGORIAS'],
    [
      'fuera del área de servicio',
      { latitud: -17.39, longitud: -66.16 },
      'FUERA_DEL_AREA_DE_SERVICIO',
    ],
    ['con una categoría mal escrita', { categorias: ['Bloqueo'] }, 'ENTRADA_INVALIDA'],
  ])('rechaza una zona %s', async (_caso, cambio, codigo) => {
    const { deps } = escenario();

    await expect(
      new SuscribirZona(deps).ejecutar({ ...nuevaZona(), ...cambio }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA', codigo });
  });
});

describe('EliminarZona', () => {
  it('HU-07: tras eliminar su zona, el usuario deja de recibir avisos de ella', async () => {
    const { deps, suscripciones, avisos } = escenario();
    await suscripciones.guardar(zona({ id: idZona(1) }));

    await new EliminarZona(suscripciones).ejecutar({ idUsuario: ana, idZona: idZona(1) });
    await new NotificarSuscriptores(deps).manejar(reporteCreado(plazaMurillo));

    expect(suscripciones.filas.size).toBe(0);
    expect(avisos).toEqual([]);
  });

  it('no permite eliminar la zona de otro usuario', async () => {
    const { suscripciones } = escenario();
    await suscripciones.guardar(zona({ id: idZona(1), idUsuario: ana }));

    await expect(
      new EliminarZona(suscripciones).ejecutar({ idUsuario: beto, idZona: idZona(1) }),
    ).rejects.toMatchObject({ tipo: 'PROHIBIDO', codigo: 'ZONA_AJENA' });
    expect(suscripciones.filas.size).toBe(1);
  });

  it('una zona inexistente da NO_ENCONTRADO', async () => {
    const { suscripciones } = escenario();

    await expect(
      new EliminarZona(suscripciones).ejecutar({ idUsuario: ana, idZona: idZona(9) }),
    ).rejects.toMatchObject({ tipo: 'NO_ENCONTRADO' });
  });
});

describe('NotificarSuscriptores', () => {
  it('HU-08: avisa de un bloqueo a 500 m con su categoría y su ubicación pública', async () => {
    const { deps, suscripciones, avisos } = escenario();
    await suscripciones.guardar(zona({ radioM: 800, categorias: [bloqueo] }));
    const punto = desplazar(plazaMurillo, 500, 0);

    expect(await new NotificarSuscriptores(deps).manejar(reporteCreado(punto))).toBe(1);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({
      idUsuario: ana,
      idReporte: ID_REPORTE,
      codigoCategoria: 'bloqueo',
    });
    expect(avisos[0]!.publicLocation.esIgualA(punto)).toBe(true);
  });

  it('HU-08: no avisa de un bloqueo a 900 m ni de un accidente a 500 m', async () => {
    const { deps, suscripciones, avisos } = escenario();
    await suscripciones.guardar(zona({ radioM: 800, categorias: [bloqueo] }));
    const notificar = new NotificarSuscriptores(deps);

    await notificar.manejar(reporteCreado(desplazar(plazaMurillo, 900, 0)));
    await notificar.manejar(reporteCreado(desplazar(plazaMurillo, 500, 0), 'accidente'));

    expect(avisos).toEqual([]);
  });

  it('HU-08: solo reacciona a la creación, así un reporte confirmado no se avisa otra vez', () => {
    const { deps } = escenario();
    const confirmado = { ...reporteCreado(plazaMurillo), tipo: 'ReporteConfirmado' };

    return expect(new NotificarSuscriptores(deps).manejar(confirmado)).rejects.toThrow(
      /Se esperaba ReporteCreado.v1/,
    );
  });

  it('HU-08: quien crea el reporte dentro de su propia zona no recibe aviso', async () => {
    const { deps, suscripciones, avisos } = escenario(ana);
    await suscripciones.guardar(zona({ idUsuario: ana }));

    expect(await new NotificarSuscriptores(deps).manejar(reporteCreado(plazaMurillo))).toBe(0);
    expect(avisos).toEqual([]);
  });

  it('un usuario con varias zonas que cubren el punto recibe un solo aviso', async () => {
    const { deps, suscripciones, avisos } = escenario(null);
    await suscripciones.guardar(zona({ id: idZona(1) }));
    await suscripciones.guardar(zona({ id: idZona(2), radioM: 2000 }));
    await suscripciones.guardar(zona({ id: idZona(3), idUsuario: beto }));

    await new NotificarSuscriptores(deps).manejar(reporteCreado(plazaMurillo));

    expect(avisos.map((a) => a.idUsuario).sort()).toEqual([ana, beto].sort());
  });

  it('si falla un envío, los demás se intentan y después se informa el fallo', async () => {
    const { deps, suscripciones, avisos } = escenario(null);
    await suscripciones.guardar(zona({ id: idZona(1), idUsuario: ana }));
    await suscripciones.guardar(zona({ id: idZona(2), idUsuario: beto }));
    const conFallo = {
      ...deps,
      enviador: {
        enviar: (aviso: AvisoDeReporte) => {
          if (aviso.idUsuario === ana) return Promise.reject(new Error('push caído'));
          avisos.push(aviso);
          return Promise.resolve();
        },
      },
    };

    await expect(
      new NotificarSuscriptores(conFallo).manejar(reporteCreado(plazaMurillo)),
    ).rejects.toThrow('push caído');
    expect(avisos.map((a) => a.idUsuario)).toEqual([beto]);
  });
});
