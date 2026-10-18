import { crearDb, migrarTodo, migracionesDePlataforma, revertirUltima } from '@gis/platform';
import type { Db } from '@gis/platform';
import { idUsuario } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioSuscripcionesPushPg } from '../adapters/push-repository.js';
import { idSuscripcionPush, SuscripcionPush } from '../domain/suscripcion-push.js';
import { notificationsModulo } from '../index.js';

const migraciones = notificationsModulo.migraciones!;
const ana = idUsuario('11111111-1111-4111-8111-111111111111');
const beto = idUsuario('22222222-2222-4222-8222-222222222222');

const suscripcion = (n: number, usuario = ana, endpoint = `https://push.test/${n}`) =>
  SuscripcionPush.restaurar({
    id: idSuscripcionPush(`eeeeeeee-eeee-4eee-8eee-${String(n).padStart(12, '0')}`),
    idUsuario: usuario,
    endpoint,
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ',
    auth: 'tBHItJI5svbpez7KI4CCXg',
    creadoEn: new Date(`2026-10-18T12:0${n}:00.000Z`),
  });

const existeLaTabla = async (db: Db): Promise<boolean> => {
  const { rows } = await db.execute(sql`select to_regclass('public.suscripciones_push') as tabla`);
  return rows[0]?.tabla !== null;
};

describeIntegration('persistencia de notifications', () => {
  let base: TestDatabase;
  let db: Db;
  let push: RepositorioSuscripcionesPushPg;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    push = new RepositorioSuscripcionesPushPg(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-08: guarda las suscripciones y las lista por usuario en orden de creación', async () => {
    await push.guardar(suscripcion(2));
    await push.guardar(suscripcion(1));
    await push.guardar(suscripcion(3, beto));

    expect((await push.buscarPorUsuario(ana)).map((s) => s.endpoint)).toEqual([
      'https://push.test/1',
      'https://push.test/2',
    ]);
    expect(await push.buscarPorUsuario(ana)).toContainEqual(suscripcion(1));
  });

  it('el mismo endpoint se reemplaza y pasa al usuario actual', async () => {
    await push.guardar(suscripcion(9, beto, 'https://push.test/1'));

    expect((await push.buscarPorUsuario(beto)).map((s) => s.endpoint)).toContain(
      'https://push.test/1',
    );
    expect((await push.buscarPorUsuario(ana)).map((s) => s.endpoint)).toEqual([
      'https://push.test/2',
    ]);
  });

  it('elimina por endpoint, solo si es del usuario indicado', async () => {
    expect(await push.eliminarPorEndpoint('https://push.test/2', beto)).toBe(false);
    expect(await push.eliminarPorEndpoint('https://push.test/2', ana)).toBe(true);
    expect(await push.eliminarPorEndpoint('https://push.test/3')).toBe(true);
    expect(await push.buscarPorUsuario(ana)).toEqual([]);
  });

  it('la migración se revierte y se vuelve a aplicar', async () => {
    await revertirUltima(db, migraciones);
    expect(await existeLaTabla(db)).toBe(false);

    await migrarTodo(db, [migraciones]);
    expect(await existeLaTabla(db)).toBe(true);
  });
});
