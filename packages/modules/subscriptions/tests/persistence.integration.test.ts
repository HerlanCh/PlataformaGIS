import { createDb, migrateAll, platformMigrations, revertLast } from '@gis/platform';
import type { Db } from '@gis/platform';
import { GeoPoint } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PgSubscriptionRepository } from '../adapters/subscription-repository.js';
import { subscriptionsModule } from '../index.js';
import { ahora, ana, beto, bloqueo, idZona, zona } from './fixtures.js';

const migraciones = subscriptionsModule.migrations!;
const minutosDespues = (minutos: number) => new Date(ahora.getTime() + minutos * 60_000);

const existeLaTabla = async (db: Db): Promise<boolean> => {
  const { rows } = await db.execute(sql`select to_regclass('public.zone_subscriptions') as tabla`);
  return rows[0]?.tabla !== null;
};

describeIntegration('persistencia de subscriptions', () => {
  let base: TestDatabase;
  let db: Db;
  let zonas: PgSubscriptionRepository;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = createDb(base.pool);
    await migrateAll(db, [platformMigrations, migraciones]);
    zonas = new PgSubscriptionRepository(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-07: guarda una zona y la recupera sin pérdida', async () => {
    await zonas.save(zona());

    expect(await zonas.findById(idZona(1))).toEqual(zona());
    expect(await zonas.findById(idZona(99))).toBeNull();
  });

  it('HU-07: lista las zonas de un usuario en el orden en que las creó', async () => {
    const segunda = zona({
      id: idZona(2),
      center: GeoPoint.create(-16.5, -68.15),
      radiusM: 100,
      categories: [bloqueo],
      now: minutosDespues(5),
    });
    await zonas.save(segunda);
    await zonas.save(zona({ id: idZona(3), userId: beto }));

    expect(await zonas.findByUser(ana)).toEqual([zona(), segunda]);
  });

  it('el centro se guarda como punto geográfico WGS84', async () => {
    const { rows } = await db.execute(
      sql`select distinct st_srid(center::geometry) as srid, geometrytype(center::geometry) as tipo
          from zone_subscriptions`,
    );

    expect(rows).toEqual([{ srid: 4326, tipo: 'POINT' }]);
  });

  it('HU-07: elimina una zona', async () => {
    expect(await zonas.delete(idZona(3))).toBe(true);

    expect(await zonas.findByUser(beto)).toEqual([]);
    expect(await zonas.delete(idZona(3))).toBe(false);
  });

  it.each([
    ['un radio mayor que 2000 m', sql`update zone_subscriptions set radius_m = 2001`],
    ['un radio menor que 100 m', sql`update zone_subscriptions set radius_m = 99`],
    ['una zona sin categorías', sql`update zone_subscriptions set categories = '{}'`],
    [
      'un centro que no es un punto',
      sql`update zone_subscriptions
          set center = 'SRID=4326;LINESTRING(-68.15 -16.5, -68.14 -16.5)'::geography`,
    ],
  ])('la base de datos rechaza %s', async (_caso, sentencia) => {
    await expect(db.execute(sentencia)).rejects.toThrow();
  });

  it('las búsquedas por usuario y por cercanía tienen sus índices', async () => {
    const { rows } = await db.execute(
      sql`select indexname from pg_indexes where tablename = 'zone_subscriptions'
          order by indexname`,
    );

    expect(rows.map((fila) => fila.indexname)).toEqual([
      'zone_subscriptions_center_idx',
      'zone_subscriptions_pkey',
      'zone_subscriptions_user_idx',
    ]);
  });
});

describeIntegration('migraciones de subscriptions', () => {
  let base: TestDatabase;
  let db: Db;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = createDb(base.pool);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('se aplican sobre una base vacía, se revierten y se vuelven a aplicar', async () => {
    await migrateAll(db, [platformMigrations, migraciones]);
    expect(await existeLaTabla(db)).toBe(true);

    expect(await revertLast(db, migraciones)).toBe('0000_zone_subscriptions');
    expect(await existeLaTabla(db)).toBe(false);

    await migrateAll(db, [platformMigrations, migraciones]);
    expect(await existeLaTabla(db)).toBe(true);
  });
});
