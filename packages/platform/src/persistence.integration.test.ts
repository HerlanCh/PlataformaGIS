import type { IntegrationEvent } from '@gis/contracts';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  appendToOutbox,
  createDb,
  migrateAll,
  migrateUp,
  migrationsTable,
  platformMigrations,
  revertLast,
} from './index.js';
import type { Db } from './index.js';

const evento = (id: string, occurredAt = '2026-10-12T12:00:00.000Z'): IntegrationEvent => ({
  id,
  type: 'ReportCreated',
  version: 1,
  occurredAt,
  payload: { reportId: id },
});

const ID_1 = '11111111-1111-4111-8111-111111111111';
const ID_2 = '22222222-2222-4222-8222-222222222222';

describeIntegration('migraciones de la plataforma', () => {
  let base: TestDatabase;
  let db: Db;

  const existe = async (tabla: string): Promise<boolean> => {
    const { rows } = await db.execute(sql`select to_regclass(${`public.${tabla}`}) as oid`);
    return rows[0]?.oid !== null;
  };
  const aplicadas = async (): Promise<number> => {
    const historial = sql.raw(`"drizzle"."${migrationsTable(platformMigrations)}"`);
    const { rows } = await db.execute(sql`select count(*)::int as total from ${historial}`);
    return Number(rows[0]?.total);
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = createDb(base.pool);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('sobre una base vacía crea PostGIS y la tabla del outbox', async () => {
    await migrateUp(db, platformMigrations);

    const { rows } = await db.execute(sql`select postgis_lib_version() as version`);
    expect(String(rows[0]?.version)).toMatch(/^3\./);
    expect(await existe('outbox_events')).toBe(true);
    expect(await aplicadas()).toBe(2);
  });

  it('volver a aplicarlas no tiene efecto', async () => {
    await migrateAll(db, [platformMigrations]);

    expect(await aplicadas()).toBe(2);
  });

  it('revierte la última migración y la quita del historial', async () => {
    expect(await revertLast(db, platformMigrations)).toBe('0001_outbox');

    expect(await existe('outbox_events')).toBe(false);
    expect(await aplicadas()).toBe(1);
  });

  it('tras revertir, aplicar de nuevo deja el mismo esquema', async () => {
    await migrateUp(db, platformMigrations);

    expect(await existe('outbox_events')).toBe(true);
    expect(await aplicadas()).toBe(2);
  });

  it('revertir todo deja la base sin migraciones y avisa cuando no queda ninguna', async () => {
    expect(await revertLast(db, platformMigrations)).toBe('0001_outbox');
    expect(await revertLast(db, platformMigrations)).toBe('0000_postgis');
    expect(await revertLast(db, platformMigrations)).toBeNull();

    await migrateUp(db, platformMigrations);
  });
});

describeIntegration('outbox', () => {
  let base: TestDatabase;
  let db: Db;

  const guardados = async () => {
    const { rows } = await db.execute(
      sql`select id, type, payload, published_at from outbox_events order by created_at`,
    );
    return rows;
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = createDb(base.pool);
    await migrateUp(db, platformMigrations);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('guarda los eventos pendientes de publicar, con su clave y su contenido', async () => {
    await appendToOutbox(db, [
      evento(ID_1, '2026-10-12T12:00:00.000Z'),
      evento(ID_2, '2026-10-12T12:00:01.000Z'),
    ]);

    expect(await guardados()).toEqual([
      { id: ID_1, type: 'ReportCreated.v1', payload: evento(ID_1), published_at: null },
      {
        id: ID_2,
        type: 'ReportCreated.v1',
        payload: evento(ID_2, '2026-10-12T12:00:01.000Z'),
        published_at: null,
      },
    ]);
  });

  it('no hace nada si no hay eventos', async () => {
    await expect(appendToOutbox(db, [])).resolves.toBeUndefined();

    expect(await guardados()).toHaveLength(2);
  });

  it('dentro de una transacción que falla no queda ningún evento', async () => {
    const ID_3 = '33333333-3333-4333-8333-333333333333';

    await expect(
      db.transaction(async (tx) => {
        await appendToOutbox(tx, [evento(ID_3)]);
        throw new Error('falló el resto de la unidad de trabajo');
      }),
    ).rejects.toThrow('falló el resto');

    expect(await guardados()).toHaveLength(2);
  });

  it('la base de datos rechaza un evento repetido', async () => {
    await expect(appendToOutbox(db, [evento(ID_1)])).rejects.toThrow();
  });
});
