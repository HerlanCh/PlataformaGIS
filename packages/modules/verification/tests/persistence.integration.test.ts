import { createDb, migrateAll, platformMigrations, revertLast } from '@gis/platform';
import type { Db } from '@gis/platform';
import { reportId } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PgReputationRepository } from '../adapters/reputation-repository.js';
import { PgVoteRepository } from '../adapters/vote-repository.js';
import { AlreadyVotedError } from '../domain/errors.js';
import { Reputation } from '../domain/reputation.js';
import { Vote } from '../domain/vote.js';
import { verificationModule } from '../index.js';
import { ahora, diasDespues, ID_REPORTE, usuario, voto } from './fixtures.js';

const migraciones = verificationModule.migrations!;
const OTRO_REPORTE = reportId('7a2d3e1f-4c8b-4e3b-8d69-1b5a6c2e3f40');

describeIntegration('persistencia de verification', () => {
  let base: TestDatabase;
  let db: Db;
  let votos: PgVoteRepository;
  let reputaciones: PgReputationRepository;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = createDb(base.pool);
    await migrateAll(db, [platformMigrations, migraciones]);
    votos = new PgVoteRepository(db);
    reputaciones = new PgReputationRepository(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-03: guarda los votos de un reporte y los recupera sin pérdida', async () => {
    await votos.save(voto(1, 'CONFIRMACION', 1.25));
    await votos.save(voto(2, 'NEGACION', 0));

    expect(await votos.findByReport(ID_REPORTE)).toEqual([
      voto(1, 'CONFIRMACION', 1.25),
      voto(2, 'NEGACION', 0),
    ]);
    expect(await votos.findByReport(OTRO_REPORTE)).toEqual([]);
  });

  it('HU-03: sabe si un usuario ya votó sobre un reporte', async () => {
    expect(await votos.exists(ID_REPORTE, usuario(1))).toBe(true);
    expect(await votos.exists(ID_REPORTE, usuario(3))).toBe(false);
    expect(await votos.exists(OTRO_REPORTE, usuario(1))).toBe(false);
  });

  it('HU-03: rechaza un segundo voto del mismo usuario sobre el mismo reporte', async () => {
    await expect(votos.save(voto(1, 'NEGACION'))).rejects.toThrow(AlreadyVotedError);

    expect(await votos.findByReport(ID_REPORTE)).toHaveLength(2);
  });

  it('el mismo usuario puede votar sobre otro reporte', async () => {
    const enOtro = Vote.restore({
      reportId: OTRO_REPORTE,
      voterId: usuario(1),
      value: 'CONFIRMACION',
      weight: 1,
      castAt: ahora,
    });

    await votos.save(enOtro);

    expect(await votos.findByReport(OTRO_REPORTE)).toEqual([enOtro]);
  });

  it('un error que no es de voto duplicado se propaga tal cual', async () => {
    const fueraDeRango = votos.save(voto(4, 'CONFIRMACION', 9)).catch((error: unknown) => error);

    expect(await fueraDeRango).toBeInstanceOf(Error);
    expect(await fueraDeRango).not.toBeInstanceOf(AlreadyVotedError);
  });

  it.each([
    [
      'un voto con un valor desconocido',
      sql`insert into votes values (${OTRO_REPORTE}, ${usuario(8)}, 'ABSTENCION', 1, now())`,
    ],
    [
      'un voto con peso negativo',
      sql`insert into votes values (${OTRO_REPORTE}, ${usuario(8)}, 'NEGACION', -0.5, now())`,
    ],
    [
      'una reputación mayor que 5',
      sql`insert into reputations (user_id, score) values (${usuario(8)}, 5.01)`,
    ],
    [
      'una reputación negativa',
      sql`insert into reputations (user_id, score) values (${usuario(8)}, -0.01)`,
    ],
  ])('la base de datos rechaza %s', async (_caso, sentencia) => {
    await expect(db.execute(sentencia)).rejects.toThrow();
  });

  it('guarda una reputación nueva y la recupera sin pérdida', async () => {
    await reputaciones.save(Reputation.initial(usuario(1)));

    expect(await reputaciones.findByUser(usuario(1))).toEqual(Reputation.initial(usuario(1)));
    expect(await reputaciones.findByUser(usuario(2))).toBeNull();
  });

  it('HU-12: guarda los cambios de reputación y la fecha de la última penalización', async () => {
    const reputacion = (await reputaciones.findByUser(usuario(1)))!;
    reputacion.reward(0.05);
    reputacion.penalize(0.5, diasDespues(1));

    await reputaciones.save(reputacion);

    const guardada = (await reputaciones.findByUser(usuario(1)))!;
    expect(guardada.score).toBe(0.55);
    expect(guardada.lastPenaltyAt).toEqual(diasDespues(1));
  });

  it('guarda los extremos del rango de reputación', async () => {
    await reputaciones.save(
      Reputation.restore({ userId: usuario(5), score: 0, lastPenaltyAt: ahora }),
    );
    await reputaciones.save(
      Reputation.restore({ userId: usuario(6), score: 5, lastPenaltyAt: null }),
    );

    expect((await reputaciones.findByUser(usuario(5)))?.isSilenced).toBe(true);
    expect((await reputaciones.findByUser(usuario(6)))?.score).toBe(5);
  });
});

describeIntegration('migraciones de verification', () => {
  let base: TestDatabase;
  let db: Db;

  const tablas = async (): Promise<string[]> => {
    const { rows } = await db.execute(
      sql`select tablename from pg_tables where schemaname = 'public'
          and tablename in ('votes', 'reputations') order by tablename`,
    );
    return rows.map((fila) => String(fila.tablename));
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = createDb(base.pool);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('se aplican sobre una base vacía, se revierten y se vuelven a aplicar', async () => {
    await migrateAll(db, [platformMigrations, migraciones]);
    expect(await tablas()).toEqual(['reputations', 'votes']);

    expect(await revertLast(db, migraciones)).toBe('0000_votes_reputations');
    expect(await tablas()).toEqual([]);

    await migrateAll(db, [platformMigrations, migraciones]);
    expect(await tablas()).toEqual(['reputations', 'votes']);
  });
});
