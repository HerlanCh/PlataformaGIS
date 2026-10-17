import { crearEvento, rechazoDeModeracionV1 } from '@gis/contracts';
import { crearDb, migrarTodo, migracionesDePlataforma } from '@gis/platform';
import type { Db } from '@gis/platform';
import { idReporte, idUsuario } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { UnidadDeTrabajoModeracionPg } from '../adapters/unidad-de-trabajo-moderacion.js';
import { AccionDeModeracion } from '../domain/accion-de-moderacion.js';
import type { IdAccionDeModeracion } from '../domain/accion-de-moderacion.js';
import { moderationModulo } from '../index.js';

const REPORTE = idReporte('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f');
const MODERADOR = idUsuario('11111111-1111-4111-8111-111111111111');
const ahora = new Date('2026-10-12T12:00:00.000Z');

const rechazo = (n: number) =>
  AccionDeModeracion.rechazo({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as IdAccionDeModeracion,
    idReporte: REPORTE,
    idModerador: MODERADOR,
    motivo: 'Reporte falso',
    ahora,
  });

const evento = (n: number) =>
  crearEvento(
    rechazoDeModeracionV1,
    { idReporte: REPORTE, idModerador: MODERADOR },
    { id: `eeeeeeee-0000-4000-8000-${String(n).padStart(12, '0')}`, ocurridoEn: ahora },
  );

describeIntegration('UnidadDeTrabajoModeracionPg', () => {
  let base: TestDatabase;
  let db: Db;

  const contar = async (tabla: string): Promise<number> => {
    const { rows } = await db.execute(sql.raw(`select count(*)::int as total from ${tabla}`));
    return Number(rows[0]?.total);
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, moderationModulo.migraciones!]);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-12: guarda la auditoría del rechazo y su evento juntos', async () => {
    await new UnidadDeTrabajoModeracionPg(db).registrar(rechazo(1), [evento(1)]);

    const { rows } = await db.execute(
      sql`select id_reporte, id_moderador, accion, motivo from acciones_moderacion`,
    );
    expect(rows).toEqual([
      { id_reporte: REPORTE, id_moderador: MODERADOR, accion: 'RECHAZAR', motivo: 'Reporte falso' },
    ]);
    expect(await contar('eventos_salida')).toBe(1);
  });

  it('atomicidad: si falla el evento, la auditoría tampoco se guarda', async () => {
    const antes = await contar('acciones_moderacion');

    await expect(
      new UnidadDeTrabajoModeracionPg(db).registrar(rechazo(2), [evento(1)]),
    ).rejects.toThrow();

    expect(await contar('acciones_moderacion')).toBe(antes);
  });
});
