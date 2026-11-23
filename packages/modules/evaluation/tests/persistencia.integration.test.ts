import { crearDb, migrarTodo, migracionesDePlataforma, revertirUltima } from '@gis/platform';
import type { Db } from '@gis/platform';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioEvaluacionPg } from '../adapters/repositorio-evaluacion-pg.js';
import { RepositorioInstantaneasPg } from '../adapters/repositorio-instantaneas-pg.js';
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

  it('HU-14: para las vistas trae los envíos de la zona que caben en alguna y las transiciones hasta el instante', async () => {
    const t = minutos(2000);
    const envio = (n: number, recibido: number, latitud = -16.5) => ({
      idEnvio: id(n),
      tipo: 'CREADO' as const,
      idReporte: id(n),
      codigoCategoria: 'infraestructura',
      publicLocation: { latitud, longitud: -68.15 },
      fuenteOficial: null,
      recibidoEn: minutos(recibido),
    });
    const transicion = (evento: number, n: number, en: number, caduca: number) => ({
      idEvento: id(evento),
      idReporte: id(n),
      estado: 'ACTIVO' as const,
      caducaEn: minutos(caduca),
      ocurridoEn: minutos(en),
    });
    // 40: reciente. 41: viejo pero vigente en t. 42: viejo y vencido. 43: fuera de la zona.
    // 44: posterior al instante.
    for (const e of [
      envio(40, 1990),
      envio(41, 100),
      envio(42, 100),
      envio(43, 1990, -16.9),
      envio(44, 2010),
    ]) {
      await registro.registrarEnvio(e);
    }
    await registro.registrarTransicion(transicion(140, 41, 100, 2100));
    await registro.registrarTransicion(transicion(141, 42, 100, 1500));
    await registro.registrarTransicion(transicion(142, 41, 2050, 2200));

    const caja = {
      latitudMin: -16.51,
      latitudMax: -16.49,
      longitudMin: -68.16,
      longitudMax: -68.14,
    };
    const { envios, transiciones } = await registro.buscarParaVistas(t, caja);

    expect(envios.map((e) => e.idEnvio).toSorted()).toEqual([id(40), id(41)]);
    expect(envios.find((e) => e.idEnvio === id(41))?.publicLocation).toEqual({
      latitud: -16.5,
      longitud: -68.15,
    });
    expect(transiciones.map((x) => x.idEvento)).toEqual([id(140)]);
  });

  it('HU-14: una instantánea se guarda con sus puntos, no admite otra con su nombre y no se puede modificar ni borrar', async () => {
    const instantaneas = new RepositorioInstantaneasPg(db);
    const caja = {
      latitudMin: -16.51,
      latitudMax: -16.49,
      longitudMin: -68.16,
      longitudMax: -68.14,
    };
    const punto = { latitud: -16.5, longitud: -68.15 };
    const e1 = {
      id: id(500),
      nombre: 'E1',
      instante: minutos(60),
      caja,
      creadaEn: minutos(90),
      procesada: [
        {
          idReporte: id(1),
          codigoCategoria: 'bloqueo',
          publicLocation: punto,
          estado: 'CONFIRMADO' as const,
          caducaEn: minutos(540),
          fuenteOficial: null,
        },
      ],
      base: [
        {
          idEnvio: id(2),
          idReporte: id(1),
          codigoCategoria: 'bloqueo',
          publicLocation: punto,
          recibidoEn: minutos(5),
          fuenteOficial: null,
        },
        {
          idEnvio: id(1),
          idReporte: id(1),
          codigoCategoria: 'bloqueo',
          publicLocation: punto,
          recibidoEn: minutos(0),
          fuenteOficial: null,
        },
      ],
    };

    await instantaneas.guardar(e1);

    expect(await instantaneas.buscarPorId(e1.id)).toEqual(e1);
    expect(await instantaneas.buscarPorId(id(501))).toBeNull();
    expect(await instantaneas.listar()).toEqual([
      expect.objectContaining({ id: e1.id, nombre: 'E1', puntosProcesada: 1, puntosBase: 2 }),
    ]);
    await expect(
      instantaneas.guardar({ ...e1, id: id(502), procesada: [], base: [] }),
    ).rejects.toMatchObject({ tipo: 'CONFLICTO', codigo: 'NOMBRE_REPETIDO' });
    for (const sentencia of [
      sql`update evaluacion_instantaneas set nombre = 'otra'`,
      sql`delete from evaluacion_puntos_instantanea`,
      sql`delete from evaluacion_instantaneas`,
    ]) {
      await expect(db.execute(sentencia)).rejects.toThrow();
    }
    expect((await instantaneas.buscarPorId(e1.id))?.base).toHaveLength(2);
  });

  it('las migraciones se revierten sin dejar tablas ni la función del disparador', async () => {
    expect(await revertirUltima(db, migraciones)).toBe('0001_instantaneas');
    expect(await revertirUltima(db, migraciones)).toBe('0000_registro_evaluacion');

    const { rows } = await bd.pool.query(
      `select 1 from information_schema.tables where table_name like 'evaluacion\\_%'
       union all select 1 from pg_proc where proname = 'evaluacion_instantanea_inmutable'`,
    );
    expect(rows).toEqual([]);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
  });
});
