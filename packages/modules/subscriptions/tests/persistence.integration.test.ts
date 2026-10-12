import { crearDb, migrarTodo, migracionesDePlataforma, revertirUltima } from '@gis/platform';
import type { Db } from '@gis/platform';
import { PuntoGeo } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioSuscripcionesPg } from '../adapters/subscription-repository.js';
import { subscriptionsModulo } from '../index.js';
import { ahora, ana, beto, bloqueo, idZona, zona } from './fixtures.js';

const migraciones = subscriptionsModulo.migraciones!;
const minutosDespues = (minutos: number) => new Date(ahora.getTime() + minutos * 60_000);

const existeLaTabla = async (db: Db): Promise<boolean> => {
  const { rows } = await db.execute(sql`select to_regclass('public.zonas_suscritas') as tabla`);
  return rows[0]?.tabla !== null;
};

describeIntegration('persistencia de subscriptions', () => {
  let base: TestDatabase;
  let db: Db;
  let zonas: RepositorioSuscripcionesPg;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    zonas = new RepositorioSuscripcionesPg(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-07: guarda una zona y la recupera sin pérdida', async () => {
    await zonas.guardar(zona());

    expect(await zonas.buscarPorId(idZona(1))).toEqual(zona());
    expect(await zonas.buscarPorId(idZona(99))).toBeNull();
  });

  it('HU-07: lista las zonas de un usuario en el orden en que las creó', async () => {
    const segunda = zona({
      id: idZona(2),
      centro: PuntoGeo.crear(-16.5, -68.15),
      radioM: 100,
      categorias: [bloqueo],
      ahora: minutosDespues(5),
    });
    await zonas.guardar(segunda);
    await zonas.guardar(zona({ id: idZona(3), idUsuario: beto }));

    expect(await zonas.buscarPorUsuario(ana)).toEqual([zona(), segunda]);
  });

  it('el centro se guarda como punto geográfico WGS84', async () => {
    const { rows } = await db.execute(
      sql`select distinct st_srid(centro::geometry) as srid, geometrytype(centro::geometry) as tipo
          from zonas_suscritas`,
    );

    expect(rows).toEqual([{ srid: 4326, tipo: 'POINT' }]);
  });

  it('HU-07: elimina una zona', async () => {
    expect(await zonas.eliminar(idZona(3))).toBe(true);

    expect(await zonas.buscarPorUsuario(beto)).toEqual([]);
    expect(await zonas.eliminar(idZona(3))).toBe(false);
  });

  it.each([
    ['un radio mayor que 2000 m', sql`update zonas_suscritas set radio_m = 2001`],
    ['un radio menor que 100 m', sql`update zonas_suscritas set radio_m = 99`],
    ['una zona sin categorías', sql`update zonas_suscritas set categorias = '{}'`],
    [
      'un centro que no es un punto',
      sql`update zonas_suscritas
          set centro = 'SRID=4326;LINESTRING(-68.15 -16.5, -68.14 -16.5)'::geography`,
    ],
  ])('la base de datos rechaza %s', async (_caso, sentencia) => {
    await expect(db.execute(sentencia)).rejects.toThrow();
  });

  it('las búsquedas por usuario y por cercanía tienen sus índices', async () => {
    const { rows } = await db.execute(
      sql`select indexname from pg_indexes where tablename = 'zonas_suscritas'
          order by indexname`,
    );

    expect(rows.map((fila) => fila.indexname)).toEqual([
      'zonas_suscritas_centro_idx',
      'zonas_suscritas_pkey',
      'zonas_suscritas_usuario_idx',
    ]);
  });
});

describeIntegration('migraciones de subscriptions', () => {
  let base: TestDatabase;
  let db: Db;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('se aplican sobre una base vacía, se revierten y se vuelven a aplicar', async () => {
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    expect(await existeLaTabla(db)).toBe(true);

    expect(await revertirUltima(db, migraciones)).toBe('0000_zonas_suscritas');
    expect(await existeLaTabla(db)).toBe(false);

    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    expect(await existeLaTabla(db)).toBe(true);
  });
});
