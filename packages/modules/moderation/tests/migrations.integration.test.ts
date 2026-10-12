import { createDb, migrateAll, platformMigrations, revertLast } from '@gis/platform';
import type { Db } from '@gis/platform';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { moderationModule } from '../index.js';

const migraciones = moderationModule.migrations!;
const REPORTE = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';
const MODERADOR = '11111111-1111-4111-8111-111111111111';

const accion = (action: string, reason: string | null): SQL =>
  sql`insert into moderation_actions (id, report_id, moderator_id, action, reason, created_at)
      values (gen_random_uuid(), ${REPORTE}, ${MODERADOR}, ${action}, ${reason}, now())`;

describeIntegration('tabla moderation_actions', () => {
  let base: TestDatabase;
  let db: Db;

  const existeLaTabla = async (): Promise<boolean> => {
    const { rows } = await db.execute(sql`select to_regclass('public.moderation_actions') as t`);
    return rows[0]?.t !== null;
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = createDb(base.pool);
    await migrateAll(db, [platformMigrations, migraciones]);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-12: registra un rechazo con su motivo y una decisión de mantener sin motivo', async () => {
    await db.execute(accion('RECHAZAR', 'Reporte falso'));
    await db.execute(accion('MANTENER', null));

    const { rows } = await db.execute(
      sql`select action, reason from moderation_actions where report_id = ${REPORTE}
          order by action`,
    );
    expect(rows).toEqual([
      { action: 'MANTENER', reason: null },
      { action: 'RECHAZAR', reason: 'Reporte falso' },
    ]);
  });

  it.each([
    ['un rechazo sin motivo', accion('RECHAZAR', null)],
    ['un rechazo con el motivo en blanco', accion('RECHAZAR', '   ')],
    ['una acción desconocida', accion('BORRAR', 'Porque sí')],
  ])('HU-12: la base de datos rechaza %s', async (_caso, sentencia) => {
    await expect(db.execute(sentencia)).rejects.toThrow();
  });

  it('las migraciones se revierten y se vuelven a aplicar', async () => {
    expect(await revertLast(db, migraciones)).toBe('0000_moderation_actions');
    expect(await existeLaTabla()).toBe(false);

    await migrateAll(db, [platformMigrations, migraciones]);
    expect(await existeLaTabla()).toBe(true);
  });
});
