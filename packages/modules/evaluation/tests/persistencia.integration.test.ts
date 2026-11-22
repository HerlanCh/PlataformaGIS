import { crearDb, migrarTodo, migracionesDePlataforma, revertirUltima } from '@gis/platform';
import type { Db } from '@gis/platform';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioEvaluacionPg } from '../adapters/repositorio-evaluacion-pg.js';
import { evaluationModulo } from '../index.js';

const migraciones = evaluationModulo.migraciones!;
const id = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;
const base = new Date('2026-11-22T12:00:00.000Z');
const minutos = (n: number) => new Date(base.getTime() + n * 60_000);

describeIntegration('registro de la evaluación en PostGIS', () => {
  let bd: TestDatabase;
  let db: Db;
  let registro: RepositorioEvaluacionPg;

  beforeAll(async () => {
    bd = await createTestDatabase();
    db = crearDb(bd.pool);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    registro = new RepositorioEvaluacionPg(db);
  });

  afterAll(async () => {
    await bd?.close();
  });

  it('HU-14: guarda envíos, transiciones y votos una sola vez, con la ubicación pública en 4326', async () => {
    const envio = {
      idEnvio: id(1),
      tipo: 'CREADO' as const,
      idReporte: id(1),
      codigoCategoria: 'bloqueo',
      publicLocation: { latitud: -16.5, longitud: -68.15 },
      fuenteOficial: null,
      recibidoEn: minutos(0),
    };
    await registro.registrarEnvio(envio);
    await registro.registrarEnvio({ ...envio, codigoCategoria: 'robo' });
    const transicion = {
      idEvento: id(10),
      idReporte: id(1),
      estado: 'ACTIVO' as const,
      caducaEn: minutos(360),
      ocurridoEn: minutos(0),
    };
    await registro.registrarTransicion(transicion);
    await registro.registrarTransicion({ ...transicion, estado: 'CONFIRMADO' });
    const voto = {
      idEvento: id(20),
      idReporte: id(1),
      valor: 'CONFIRMACION' as const,
      peso: 1.25,
      decision: 'NINGUNA' as const,
      ocurridoEn: minutos(3),
    };
    await registro.registrarVoto(voto);
    await registro.registrarVoto({ ...voto, peso: 2 });

    const { rows } = await bd.pool.query<Record<string, unknown>>(`
      select e.codigo_categoria, st_srid(e.ubicacion_publica) as srid, st_y(e.ubicacion_publica) as latitud,
             t.estado, v.peso
      from evaluacion_envios e, evaluacion_transiciones t, evaluacion_votos v`);
    expect(rows).toEqual([
      { codigo_categoria: 'bloqueo', srid: 4326, latitud: -16.5, estado: 'ACTIVO', peso: 1.25 },
    ]);
    expect(await registro.estado()).toEqual({ enviosRegistrados: 1, ultimoEnvioEn: minutos(0) });
  });

  it('HU-14: ninguna tabla evaluacion_* tiene columnas de ubicación real, autor, votante ni reportante', async () => {
    const { rows } = await bd.pool.query<{ column_name: string }>(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name like 'evaluacion\\_%'`);
    const columnas = rows.map((r) => r.column_name);

    expect(columnas.length).toBeGreaterThan(0);
    expect(columnas).toContain('ubicacion_publica');
    expect(columnas.filter((c) => /^ubicacion$|autor|votante|reportante|usuario/.test(c))).toEqual(
      [],
    );
  });

  it('rechaza estados, tipos y pesos fuera del catálogo', async () => {
    await expect(
      db.execute(sql`insert into evaluacion_transiciones values
        (${id(30)}, ${id(1)}, 'BORRADO', null, now())`),
    ).rejects.toThrow();
    await expect(
      db.execute(sql`insert into evaluacion_transiciones values
        (${id(31)}, ${id(1)}, 'CADUCADO', now(), now())`),
    ).rejects.toThrow();
    await expect(
      db.execute(sql`insert into evaluacion_votos values
        (${id(32)}, ${id(1)}, 'CONFIRMACION', 6, 'NINGUNA', now())`),
    ).rejects.toThrow();
  });

  it('la migración se revierte sin dejar tablas', async () => {
    expect(await revertirUltima(db, migraciones)).toBe('0000_registro_evaluacion');

    const { rows } = await bd.pool.query(
      `select 1 from information_schema.tables where table_name like 'evaluacion\\_%'`,
    );
    expect(rows).toEqual([]);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
  });
});
