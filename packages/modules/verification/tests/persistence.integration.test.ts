import { crearDb, migrarTodo, migracionesDePlataforma, revertirUltima } from '@gis/platform';
import type { Db } from '@gis/platform';
import { idReporte } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioReputacionesPg } from '../adapters/reputation-repository.js';
import { RepositorioVotosPg } from '../adapters/vote-repository.js';
import { ErrorYaVoto } from '../domain/errors.js';
import { Reputacion } from '../domain/reputation.js';
import { Voto } from '../domain/vote.js';
import { verificationModulo } from '../index.js';
import { ahora, diasDespues, ID_REPORTE, usuario, voto } from './fixtures.js';

const migraciones = verificationModulo.migraciones!;
const OTRO_REPORTE = idReporte('7a2d3e1f-4c8b-4e3b-8d69-1b5a6c2e3f40');

describeIntegration('persistencia de verification', () => {
  let base: TestDatabase;
  let db: Db;
  let votos: RepositorioVotosPg;
  let reputaciones: RepositorioReputacionesPg;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    votos = new RepositorioVotosPg(db);
    reputaciones = new RepositorioReputacionesPg(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-03: guarda los votos de un reporte y los recupera sin pérdida', async () => {
    await votos.guardar(voto(1, 'CONFIRMACION', 1.25));
    await votos.guardar(voto(2, 'NEGACION', 0));

    expect(await votos.buscarPorReporte(ID_REPORTE)).toEqual([
      voto(1, 'CONFIRMACION', 1.25),
      voto(2, 'NEGACION', 0),
    ]);
    expect(await votos.buscarPorReporte(OTRO_REPORTE)).toEqual([]);
  });

  it('HU-03: sabe si un usuario ya votó sobre un reporte', async () => {
    expect(await votos.existe(ID_REPORTE, usuario(1))).toBe(true);
    expect(await votos.existe(ID_REPORTE, usuario(3))).toBe(false);
    expect(await votos.existe(OTRO_REPORTE, usuario(1))).toBe(false);
  });

  it('HU-03: rechaza un segundo voto del mismo usuario sobre el mismo reporte', async () => {
    await expect(votos.guardar(voto(1, 'NEGACION'))).rejects.toThrow(ErrorYaVoto);

    expect(await votos.buscarPorReporte(ID_REPORTE)).toHaveLength(2);
  });

  it('el mismo usuario puede votar sobre otro reporte', async () => {
    const enOtro = Voto.restaurar({
      idReporte: OTRO_REPORTE,
      idVotante: usuario(1),
      valor: 'CONFIRMACION',
      peso: 1,
      emitidoEn: ahora,
    });

    await votos.guardar(enOtro);

    expect(await votos.buscarPorReporte(OTRO_REPORTE)).toEqual([enOtro]);
  });

  it('un error que no es de voto duplicado se propaga tal cual', async () => {
    const fueraDeRango = votos.guardar(voto(4, 'CONFIRMACION', 9)).catch((error: unknown) => error);

    expect(await fueraDeRango).toBeInstanceOf(Error);
    expect(await fueraDeRango).not.toBeInstanceOf(ErrorYaVoto);
  });

  it.each([
    [
      'un voto con un valor desconocido',
      sql`insert into votos values (${OTRO_REPORTE}, ${usuario(8)}, 'ABSTENCION', 1, now())`,
    ],
    [
      'un voto con peso negativo',
      sql`insert into votos values (${OTRO_REPORTE}, ${usuario(8)}, 'NEGACION', -0.5, now())`,
    ],
    [
      'una reputación mayor que 5',
      sql`insert into reputaciones (id_usuario, puntaje) values (${usuario(8)}, 5.01)`,
    ],
    [
      'una reputación negativa',
      sql`insert into reputaciones (id_usuario, puntaje) values (${usuario(8)}, -0.01)`,
    ],
  ])('la base de datos rechaza %s', async (_caso, sentencia) => {
    await expect(db.execute(sentencia)).rejects.toThrow();
  });

  it('guarda una reputación nueva y la recupera sin pérdida', async () => {
    await reputaciones.guardar(Reputacion.inicial(usuario(1)));

    expect(await reputaciones.buscarPorUsuario(usuario(1))).toEqual(Reputacion.inicial(usuario(1)));
    expect(await reputaciones.buscarPorUsuario(usuario(2))).toBeNull();
  });

  it('HU-12: guarda los cambios de reputación y la fecha de la última penalización', async () => {
    const reputacion = (await reputaciones.buscarPorUsuario(usuario(1)))!;
    reputacion.premiar(0.05);
    reputacion.penalizar(0.5, diasDespues(1));

    await reputaciones.guardar(reputacion);

    const guardada = (await reputaciones.buscarPorUsuario(usuario(1)))!;
    expect(guardada.puntaje).toBe(0.55);
    expect(guardada.ultimaPenalizacionEn).toEqual(diasDespues(1));
  });

  it('guarda los extremos del rango de reputación', async () => {
    await reputaciones.guardar(
      Reputacion.restaurar({ idUsuario: usuario(5), puntaje: 0, ultimaPenalizacionEn: ahora }),
    );
    await reputaciones.guardar(
      Reputacion.restaurar({ idUsuario: usuario(6), puntaje: 5, ultimaPenalizacionEn: null }),
    );

    expect((await reputaciones.buscarPorUsuario(usuario(5)))?.estaSilenciado).toBe(true);
    expect((await reputaciones.buscarPorUsuario(usuario(6)))?.puntaje).toBe(5);
  });
});

describeIntegration('migraciones de verification', () => {
  let base: TestDatabase;
  let db: Db;

  const tablas = async (): Promise<string[]> => {
    const { rows } = await db.execute(
      sql`select tablename from pg_tables where schemaname = 'public'
          and tablename in ('votos', 'reputaciones') order by tablename`,
    );
    return rows.map((fila) => String(fila.tablename));
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('se aplican sobre una base vacía, se revierten y se vuelven a aplicar', async () => {
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    expect(await tablas()).toEqual(['reputaciones', 'votos']);

    expect(await revertirUltima(db, migraciones)).toBe('0000_votos_reputaciones');
    expect(await tablas()).toEqual([]);

    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    expect(await tablas()).toEqual(['reputaciones', 'votos']);
  });
});
