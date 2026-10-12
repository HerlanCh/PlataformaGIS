import { crearDb, migrarTodo, migracionesDePlataforma } from '@gis/platform';
import type { Db } from '@gis/platform';
import { codigoCategoria, PuntoGeo } from '@gis/shared-kernel';
import type { CajaGeografica } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration, desplazar as desplazarDesde } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { ConsultaMapaCalorPg } from '../adapters/consulta-mapa-calor.js';
import { ErrorConsultaDeCalorInvalida } from '../domain/consulta-de-calor.js';
import type { ConsultaDeCalor } from '../domain/consulta-de-calor.js';

const plazaMurillo = PuntoGeo.crear(-16.4955, -68.1336);
const desplazar = (norteM: number, esteM: number): PuntoGeo =>
  desplazarDesde(plazaMurillo, norteM, esteM);

const caja: CajaGeografica = {
  latitudMin: -16.52,
  latitudMax: -16.47,
  longitudMin: -68.16,
  longitudMax: -68.11,
};
const desde = new Date('2026-10-01T00:00:00Z');
const hasta = new Date('2026-10-31T00:00:00Z');
const dentroDelRango = new Date('2026-10-12T12:00:00Z');

const consulta = (cambios: Partial<ConsultaDeCalor> = {}): ConsultaDeCalor => ({
  caja,
  tamanoCeldaM: 500,
  desde,
  hasta,
  categorias: [],
  ...cambios,
});

interface Opciones {
  categoria?: string;
  estado?: string;
  creadoEn?: Date;
}

describeIntegration('mapa de calor', () => {
  let base: TestDatabase;
  let db: Db;
  let calor: ConsultaMapaCalorPg;

  const insertar = async (punto: PuntoGeo, opciones: Opciones = {}) => {
    const { categoria = 'bloqueo', estado = 'ACTIVO', creadoEn = dentroDelRango } = opciones;
    await db.execute(sql`
      insert into reportes (codigo_categoria, estado, creado_en, ubicacion_publica)
      values (${categoria}, ${estado}, ${creadoEn.toISOString()}, st_setsrid(st_makepoint(${punto.longitud}, ${punto.latitud}), 4326))
    `);
  };

  /** Tres reportes a pocos metros entre sí: caen en la misma celda de 500 m. */
  const insertarTres = async (norteM = 0, esteM = 0, opciones: Opciones = {}) => {
    await insertar(desplazar(norteM, esteM), opciones);
    await insertar(desplazar(norteM + 10, esteM + 10), opciones);
    await insertar(desplazar(norteM - 10, esteM + 5), opciones);
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma]);
    // `reportes` es del módulo `reports` y este módulo no puede importarlo: la prueba crea solo
    // las columnas que lee el mapa de calor. `pnpm perf:espacial` lo ejercita con el esquema real.
    await db.execute(sql`
      create table reportes (
        id uuid primary key default gen_random_uuid(),
        codigo_categoria text not null,
        estado text not null,
        creado_en timestamptz not null,
        ubicacion_publica geometry(Point, 4326) not null
      )
    `);
    calor = new ConsultaMapaCalorPg(db);
  });

  beforeEach(async () => {
    await db.execute(sql`delete from reportes`);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-06: una celda con 2 reportes no aparece', async () => {
    await insertar(plazaMurillo);
    await insertar(desplazar(10, 10));

    expect(await calor.agregar(consulta())).toEqual([]);
  });

  it('HU-06: una celda con 3 reportes aparece con su cantidad', async () => {
    await insertarTres();

    const celdas = await calor.agregar(consulta());

    expect(celdas).toHaveLength(1);
    expect(celdas[0]?.cantidad).toBe(3);
  });

  it('HU-06: los reportes de celdas distintas no se suman', async () => {
    await insertar(plazaMurillo);
    await insertar(desplazar(10, 10));
    await insertar(desplazar(2000, 2000));
    await insertar(desplazar(2010, 2010));

    expect(await calor.agregar(consulta())).toEqual([]);
  });

  it('HU-06: devuelve las celdas densas de mayor a menor cantidad', async () => {
    await insertarTres();
    await insertarTres(2000, 2000);
    await insertar(desplazar(2005, 2000));

    const celdas = await calor.agregar(consulta());

    expect(celdas.map((celda) => celda.cantidad)).toEqual([4, 3]);
  });

  it('HU-06: no cuenta los reportes rechazados', async () => {
    await insertar(plazaMurillo);
    await insertar(desplazar(10, 10));
    await insertar(desplazar(-10, 5), { estado: 'RECHAZADO' });

    expect(await calor.agregar(consulta())).toEqual([]);
  });

  it('HU-06: cuenta los reportes que ya caducaron o se resolvieron', async () => {
    await insertar(plazaMurillo, { estado: 'CADUCADO' });
    await insertar(desplazar(10, 10), { estado: 'RESUELTO' });
    await insertar(desplazar(-10, 5), { estado: 'CONFIRMADO' });

    expect((await calor.agregar(consulta()))[0]?.cantidad).toBe(3);
  });

  it('HU-06: respeta el rango de fechas, con los extremos incluidos', async () => {
    await insertar(plazaMurillo, { creadoEn: desde });
    await insertar(desplazar(10, 10), { creadoEn: hasta });
    await insertar(desplazar(-10, 5), { creadoEn: new Date('2026-11-01T00:00:00Z') });

    expect(await calor.agregar(consulta())).toEqual([]);

    await insertar(desplazar(5, -5));
    expect((await calor.agregar(consulta()))[0]?.cantidad).toBe(3);
  });

  it('HU-06: filtra por categoría', async () => {
    await insertar(plazaMurillo, { categoria: 'robo' });
    await insertar(desplazar(10, 10), { categoria: 'robo' });
    await insertar(desplazar(-10, 5), { categoria: 'bloqueo' });

    const robos = await calor.agregar(consulta({ categorias: [codigoCategoria('robo')] }));
    const ambas = await calor.agregar(
      consulta({ categorias: [codigoCategoria('robo'), codigoCategoria('bloqueo')] }),
    );

    expect(robos).toEqual([]);
    expect(ambas[0]?.cantidad).toBe(3);
  });

  it('solo cuenta los reportes dentro de la caja', async () => {
    await insertarTres();
    const otraZona: CajaGeografica = {
      latitudMin: -16.6,
      latitudMax: -16.55,
      longitudMin: -68.2,
      longitudMax: -68.15,
    };

    expect(await calor.agregar(consulta({ caja: otraZona }))).toEqual([]);
  });

  it('HU-06: la cuadrícula no se mueve al desplazar la ventana', async () => {
    await insertarTres();
    const corrida: CajaGeografica = {
      latitudMin: caja.latitudMin + 0.0137,
      latitudMax: caja.latitudMax + 0.0137,
      longitudMin: caja.longitudMin + 0.0091,
      longitudMax: caja.longitudMax + 0.0091,
    };

    const original = await calor.agregar(consulta());
    const desplazada = await calor.agregar(consulta({ caja: corrida }));

    expect(original).toHaveLength(1);
    expect(desplazada).toEqual(original);
  });

  it('HU-06: una celda cortada por el borde de la ventana se cuenta completa', async () => {
    await insertar(desplazar(-10, 0));
    await insertar(plazaMurillo);
    await insertar(desplazar(10, 0));
    // El borde sur de la ventana pasa entre los reportes: solo el tercero queda dentro.
    const cortada: CajaGeografica = { ...caja, latitudMin: desplazar(5, 0).latitud };

    const celdas = await calor.agregar(consulta({ caja: cortada }));

    expect(celdas.map((celda) => celda.cantidad)).toEqual([3]);
  });

  it('HU-06: mover la ventana unos metros no cambia el conteo de una celda', async () => {
    await insertarTres();
    await insertar(desplazar(20, 0));
    const conteos = new Set<number | undefined>();

    for (const corrimientoM of [0, 5, 15, 25, 60]) {
      const movida: CajaGeografica = { ...caja, latitudMin: desplazar(corrimientoM, 0).latitud };
      conteos.add((await calor.agregar(consulta({ caja: movida })))[0]?.cantidad);
    }

    expect([...conteos]).toEqual([4]);
  });

  it('rechaza una consulta inválida antes de llegar a la base de datos', async () => {
    await expect(calor.agregar(consulta({ tamanoCeldaM: 10 }))).rejects.toThrow(
      ErrorConsultaDeCalorInvalida,
    );
  });
});
