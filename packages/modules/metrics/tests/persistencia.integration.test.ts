import { crearDb, migrarTodo, migracionesDePlataforma, revertirUltima } from '@gis/platform';
import type { Db } from '@gis/platform';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioMetricasPg } from '../adapters/repositorio-metricas-pg.js';
import type { RegistroDeReporte } from '../domain/metricas.js';
import { metricsModulo } from '../index.js';

const migraciones = metricsModulo.migraciones!;
const id = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;
const huella = (letra: string) => letra.repeat(64);
const creado = new Date('2026-10-24T12:00:00.000Z');
const minutos = (n: number) => new Date(creado.getTime() + n * 60_000);

const registro = (n: number, cambios: Partial<RegistroDeReporte> = {}): RegistroDeReporte => ({
  idReporte: id(n),
  codigoCategoria: 'bloqueo',
  esOficial: false,
  creadoEn: creado,
  primeraConfirmacionEn: null,
  confirmadoEn: null,
  cierre: null,
  cerradoEn: null,
  ...cambios,
});

describeIntegration('métricas del piloto en PostGIS', () => {
  let base: TestDatabase;
  let db: Db;
  let metricas: RepositorioMetricasPg;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    metricas = new RepositorioMetricasPg(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('guarda cada hito una sola vez: el primero gana', async () => {
    await metricas.registrarCreacion(registro(1));
    await metricas.registrarCreacion(registro(1, { codigoCategoria: 'robo' }));
    await metricas.marcarPrimeraConfirmacion(id(1), minutos(3));
    await metricas.marcarPrimeraConfirmacion(id(1), minutos(9));
    await metricas.marcarConfirmado(id(1), minutos(9));
    await metricas.marcarCierre(id(1), 'CADUCIDAD', minutos(540));
    await metricas.marcarCierre(id(1), 'VOTOS', minutos(600));
    // Un reporte creado antes de activar el módulo no tiene fila: no pasa nada.
    await metricas.marcarCierre(id(99), 'VOTOS', minutos(600));

    expect(await metricas.buscarRegistros(creado, minutos(1))).toEqual([
      registro(1, {
        primeraConfirmacionEn: minutos(3),
        confirmadoEn: minutos(9),
        cierre: 'CADUCIDAD',
        cerradoEn: minutos(540),
      }),
    ]);
  });

  it('busca por fecha de creación en [desde, hasta)', async () => {
    await metricas.registrarCreacion(registro(2, { creadoEn: minutos(60) }));

    expect((await metricas.buscarRegistros(creado, minutos(60))).map((r) => r.idReporte)).toEqual([
      id(1),
    ]);
    expect(await metricas.buscarRegistros(minutos(61), minutos(120))).toEqual([]);
  });

  it('cuenta una vez cada huella por día y al consolidar deja solo el conteo', async () => {
    await metricas.registrarActividad('2026-10-24', huella('a'));
    await metricas.registrarActividad('2026-10-24', huella('a'));
    await metricas.registrarActividad('2026-10-24', huella('b'));
    await metricas.registrarActividad('2026-10-25', huella('a'));

    await metricas.consolidarAntesDe('2026-10-25');
    await metricas.consolidarAntesDe('2026-10-25');

    expect(await metricas.actividadEntre('2026-10-24', '2026-10-25')).toEqual([
      { dia: '2026-10-24', usuariosActivos: 2 },
      { dia: '2026-10-25', usuariosActivos: 1 },
    ]);
    const { rows } = await db.execute(sql`select dia::text from metricas_actividad order by dia`);
    expect(rows).toEqual([{ dia: '2026-10-25' }]);
    expect(await metricas.actividadEntre('2026-10-26', '2026-10-30')).toEqual([]);
  });

  it('RNF-14: ninguna tabla tiene columnas de autor, votante, ubicación ni descripción', async () => {
    const { rows } = await db.execute(
      sql`select table_name, column_name from information_schema.columns
          where table_name like 'metricas_%' order by table_name, column_name`,
    );

    expect(rows.map((r) => `${String(r.table_name)}.${String(r.column_name)}`)).toEqual([
      'metricas_actividad.dia',
      'metricas_actividad.huella',
      'metricas_diarias.dia',
      'metricas_diarias.usuarios_activos',
      'metricas_reportes.cerrado_en',
      'metricas_reportes.cierre',
      'metricas_reportes.codigo_categoria',
      'metricas_reportes.confirmado_en',
      'metricas_reportes.creado_en',
      'metricas_reportes.es_oficial',
      'metricas_reportes.id_reporte',
      'metricas_reportes.primera_confirmacion_en',
    ]);
  });

  it('la base rechaza una huella que no es un HMAC y un cierre sin hora', async () => {
    await expect(metricas.registrarActividad('2026-10-24', 'id-en-claro')).rejects.toThrow();
    await expect(
      db.execute(sql`update metricas_reportes set cierre = 'VOTOS', cerrado_en = null`),
    ).rejects.toThrow();
  });

  it('las migraciones se revierten y se vuelven a aplicar', async () => {
    expect(await revertirUltima(db, migraciones)).toBe('0000_metricas_piloto');
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);

    expect(await metricas.buscarRegistros(new Date(0), minutos(10_000))).toEqual([]);
  });
});
