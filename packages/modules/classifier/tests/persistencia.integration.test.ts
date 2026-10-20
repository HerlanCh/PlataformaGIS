import { crearEvento, reporteClasificadoV1 } from '@gis/contracts';
import { crearDb, migrarTodo, migracionesDePlataforma, revertirUltima } from '@gis/platform';
import type { Db } from '@gis/platform';
import { idReporte } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { UnidadDeTrabajoClasificacionPg } from '../adapters/unidad-de-trabajo-clasificacion.js';
import type { IdClasificacion, RegistroDeClasificacion } from '../domain/clasificacion.js';
import { classifierModulo } from '../index.js';

const migraciones = classifierModulo.migraciones!;
const REPORTE = idReporte('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f');
const ahora = new Date('2026-10-19T12:00:00.000Z');
const uuid = (prefijo: string, n: number) =>
  `${prefijo}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const registro = (n: number): RegistroDeClasificacion => ({
  id: uuid('00000000', n) as IdClasificacion,
  idReporte: REPORTE,
  sospechoso: true,
  motivos: ['ENLACE', 'SPAM'],
  puntaje: 1,
  clasificador: 'reglas-v1',
  creadoEn: ahora,
});

const evento = (n: number) =>
  crearEvento(
    reporteClasificadoV1,
    { idReporte: REPORTE, sospechoso: true, motivos: ['ENLACE'], clasificador: 'reglas-v1' },
    { id: uuid('eeeeeeee', n), ocurridoEn: ahora },
  );

describeIntegration('persistencia de classifier', () => {
  let base: TestDatabase;
  let db: Db;

  const contar = async (tabla: string): Promise<number> => {
    const { rows } = await db.execute(sql.raw(`select count(*)::int as total from ${tabla}`));
    return Number(rows[0]?.total);
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-10: guarda la clasificación con sus motivos y su evento juntos', async () => {
    await new UnidadDeTrabajoClasificacionPg(db).registrar(registro(1), [evento(1)]);

    const { rows } = await db.execute(
      sql`select sospechoso, motivos, puntaje, clasificador from clasificaciones`,
    );
    expect(rows).toEqual([
      { sospechoso: true, motivos: ['ENLACE', 'SPAM'], puntaje: 1, clasificador: 'reglas-v1' },
    ]);
    expect(await contar('eventos_salida')).toBe(1);
  });

  it('atomicidad: si falla el evento, la clasificación no se guarda', async () => {
    const antes = await contar('clasificaciones');

    await expect(
      new UnidadDeTrabajoClasificacionPg(db).registrar(registro(2), [evento(1)]),
    ).rejects.toThrow();

    expect(await contar('clasificaciones')).toBe(antes);
  });

  it('la base de datos rechaza un puntaje fuera de 0 a 1', async () => {
    await expect(db.execute(sql`update clasificaciones set puntaje = 1.5`)).rejects.toThrow();
  });

  it('las migraciones se revierten y se vuelven a aplicar', async () => {
    expect(await revertirUltima(db, migraciones)).toBe('0000_clasificaciones');
    const { rows } = await db.execute(sql`select to_regclass('public.clasificaciones') as t`);
    expect(rows[0]?.t).toBeNull();

    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    expect(await contar('clasificaciones')).toBe(0);
  });
});
