import { createDb, migrateAll, platformMigrations } from '@gis/platform';
import type { Db } from '@gis/platform';
import { userId } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PgUserRepository } from '../adapters/user-repository.js';
import { User } from '../domain/user.js';
import { identityModule } from '../index.js';

const ana = userId('11111111-1111-4111-8111-111111111111');
const beto = userId('22222222-2222-4222-8222-222222222222');
const now = new Date('2026-10-12T12:00:00.000Z');

const nuevo = (id = ana, deviceHash = 'hash-del-dispositivo-de-ana') =>
  User.registerDevice({ id, deviceHash, now });

describeIntegration('PgUserRepository', () => {
  let base: TestDatabase;
  let db: Db;
  let repo: PgUserRepository;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = createDb(base.pool);
    await migrateAll(db, [platformMigrations, identityModule.migrations!]);
    repo = new PgUserRepository(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('guarda un usuario y lo recupera sin pérdida', async () => {
    await repo.save(nuevo());

    expect(await repo.findById(ana)).toMatchObject({
      id: ana,
      deviceHash: 'hash-del-dispositivo-de-ana',
      role: 'CIUDADANO',
      telegramId: null,
      createdAt: now,
    });
  });

  it('lo encuentra por el hash de su dispositivo', async () => {
    expect((await repo.findByDeviceHash('hash-del-dispositivo-de-ana'))?.id).toBe(ana);
  });

  it('devuelve null cuando no existe', async () => {
    expect(await repo.findById(beto)).toBeNull();
    expect(await repo.findByDeviceHash('hash-desconocido-0000')).toBeNull();
    expect(await repo.findByTelegramId('999')).toBeNull();
  });

  it('guarda los cambios de un usuario existente', async () => {
    const usuario = (await repo.findById(ana))!;
    usuario.linkTelegram('123456789');
    usuario.promoteToModerator();

    await repo.save(usuario);

    expect(await repo.findByTelegramId('123456789')).toMatchObject({
      id: ana,
      role: 'MODERADOR',
      telegramId: '123456789',
    });
  });

  it('la base de datos rechaza dos usuarios con el mismo dispositivo', async () => {
    await expect(repo.save(nuevo(beto, 'hash-del-dispositivo-de-ana'))).rejects.toThrow();
  });

  it('la base de datos rechaza dos usuarios con el mismo Telegram', async () => {
    const otro = User.registerDevice({
      id: beto,
      deviceHash: 'hash-del-dispositivo-de-beto',
      telegramId: '123456789',
      now,
    });

    await expect(repo.save(otro)).rejects.toThrow();
  });

  it('la base de datos rechaza un rol desconocido', async () => {
    const insertar = db.execute(
      sql`insert into usuarios (id, hash_dispositivo, rol, creado_en)
          values (${beto}, 'hash-de-prueba-de-rol-00', 'ADMIN', now())`,
    );

    await expect(insertar).rejects.toThrow();
  });
});
