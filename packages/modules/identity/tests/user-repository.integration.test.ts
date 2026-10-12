import { crearDb, migrarTodo, migracionesDePlataforma } from '@gis/platform';
import type { Db } from '@gis/platform';
import { idUsuario } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioUsuariosPg } from '../adapters/user-repository.js';
import { Usuario } from '../domain/user.js';
import { identityModulo } from '../index.js';

const ana = idUsuario('11111111-1111-4111-8111-111111111111');
const beto = idUsuario('22222222-2222-4222-8222-222222222222');
const ahora = new Date('2026-10-12T12:00:00.000Z');

const nuevo = (id = ana, hashDispositivo = 'hash-del-dispositivo-de-ana') =>
  Usuario.registrarDispositivo({ id, hashDispositivo, ahora });

describeIntegration('RepositorioUsuariosPg', () => {
  let base: TestDatabase;
  let db: Db;
  let repo: RepositorioUsuariosPg;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, identityModulo.migraciones!]);
    repo = new RepositorioUsuariosPg(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('guarda un usuario y lo recupera sin pérdida', async () => {
    await repo.guardar(nuevo());

    expect(await repo.buscarPorId(ana)).toMatchObject({
      id: ana,
      hashDispositivo: 'hash-del-dispositivo-de-ana',
      rol: 'CIUDADANO',
      idTelegram: null,
      creadoEn: ahora,
    });
  });

  it('lo encuentra por el hash de su dispositivo', async () => {
    expect((await repo.buscarPorHashDispositivo('hash-del-dispositivo-de-ana'))?.id).toBe(ana);
  });

  it('devuelve null cuando no existe', async () => {
    expect(await repo.buscarPorId(beto)).toBeNull();
    expect(await repo.buscarPorHashDispositivo('hash-desconocido-0000')).toBeNull();
    expect(await repo.buscarPorIdTelegram('999')).toBeNull();
  });

  it('guarda los cambios de un usuario existente', async () => {
    const usuario = (await repo.buscarPorId(ana))!;
    usuario.vincularTelegram('123456789');
    usuario.ascenderAModerador();

    await repo.guardar(usuario);

    expect(await repo.buscarPorIdTelegram('123456789')).toMatchObject({
      id: ana,
      rol: 'MODERADOR',
      idTelegram: '123456789',
    });
  });

  it('la base de datos rechaza dos usuarios con el mismo dispositivo', async () => {
    await expect(repo.guardar(nuevo(beto, 'hash-del-dispositivo-de-ana'))).rejects.toThrow();
  });

  it('la base de datos rechaza dos usuarios con el mismo Telegram', async () => {
    const otro = Usuario.registrarDispositivo({
      id: beto,
      hashDispositivo: 'hash-del-dispositivo-de-beto',
      idTelegram: '123456789',
      ahora,
    });

    await expect(repo.guardar(otro)).rejects.toThrow();
  });

  it('la base de datos rechaza un rol desconocido', async () => {
    const insertar = db.execute(
      sql`insert into usuarios (id, hash_dispositivo, rol, creado_en)
          values (${beto}, 'hash-de-prueba-de-rol-00', 'ADMIN', now())`,
    );

    await expect(insertar).rejects.toThrow();
  });
});
