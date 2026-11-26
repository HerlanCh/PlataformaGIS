import { crearDb, migrarTodo, migracionesDePlataforma, revertirUltima } from '@gis/platform';
import type { Db } from '@gis/platform';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioEvaluacionPg } from '../adapters/repositorio-evaluacion-pg.js';
import {
  RepositorioEtiquetasPg,
  RepositorioSesionesPg,
  RepositorioVerificacionesPg,
} from '../adapters/repositorio-herramientas-pg.js';
import { RepositorioExportacionPg } from '../adapters/repositorio-exportacion-pg.js';
import { RepositorioInstantaneasPg } from '../adapters/repositorio-instantaneas-pg.js';
import { COLUMNAS_EXPORTADAS } from '../domain/exportacion.js';
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

  it('HU-14: sesiones y tareas: inicio y cierre solo una vez, marcas guardadas y código único', async () => {
    const sesiones = new RepositorioSesionesPg(db);
    const tarea = (n: number, orden: 1 | 2) => ({
      id: id(n),
      idSesion: id(600),
      orden,
      vista: orden === 1 ? ('BASE' as const) : ('PROCESADA' as const),
      escenario: 'E1' as const,
      idInstantanea: id(500),
      iniciadaEn: null,
      terminadaEn: null,
      duracionMs: null,
      agotada: null,
      marcas: [],
    });
    const sesion = {
      id: id(600),
      codigoParticipante: 'P01',
      secuencia: 1 as const,
      creadaEn: minutos(0),
      tareas: [tarea(601, 1), tarea(602, 2)] as const,
    };
    await sesiones.crear(sesion);
    const cierre = {
      terminadaEn: minutos(2),
      duracionMs: 120_000,
      agotada: false,
      marcas: [{ idPunto: id(2), msDesdeInicio: 3_000 }],
    };

    expect(await sesiones.cerrar(id(601), cierre)).toBe(false);
    expect([
      await sesiones.iniciar(id(601), minutos(0)),
      await sesiones.iniciar(id(601), minutos(1)),
    ]).toEqual([true, false]);
    expect([
      await sesiones.cerrar(id(601), cierre),
      await sesiones.cerrar(id(601), cierre),
    ]).toEqual([true, false]);
    const leida = await sesiones.buscarPorTarea(id(602));
    expect(leida?.tareas[0]).toMatchObject({ iniciadaEn: minutos(0), ...cierre });
    expect(leida?.tareas[1]).toMatchObject({ orden: 2, iniciadaEn: null, marcas: [] });
    expect(await sesiones.listar()).toHaveLength(1);
    expect(await sesiones.buscarPorTarea(id(699))).toBeNull();
    await expect(
      sesiones.crear({ ...sesion, id: id(610), tareas: [tarea(611, 1), tarea(612, 2)] }),
    ).rejects.toMatchObject({
      codigo: 'PARTICIPANTE_REPETIDO',
    });
    await expect(
      db.execute(sql`insert into evaluacion_sesiones values (${id(620)}, 'Ana', 1, now())`),
    ).rejects.toThrow();
  });

  it('HU-14: etiquetas por evaluador se corrigen o se quitan; verificaciones se corrigen', async () => {
    const etiquetas = new RepositorioEtiquetasPg(db);
    const verificaciones = new RepositorioVerificacionesPg(db);
    await etiquetas.guardar('A', [
      { idEnvio: id(1), grupo: 'x' },
      { idEnvio: id(40), grupo: 'x' },
    ]);
    await etiquetas.guardar('B', [{ idEnvio: id(1), grupo: 'y' }]);
    await etiquetas.guardar('A', [
      { idEnvio: id(1), grupo: 'z' },
      { idEnvio: id(40), grupo: null },
    ]);
    const verificacion = {
      idReporte: id(1),
      resultado: 'NO_VERIFICABLE' as const,
      finEn: null,
      fuente: 'SECUNDARIA' as const,
      detalleFuente: null,
      registradaEn: minutos(10),
    };
    await verificaciones.guardar(verificacion);
    await verificaciones.guardar({
      ...verificacion,
      resultado: 'REAL',
      finEn: minutos(5),
      registradaEn: minutos(20),
    });

    expect(await etiquetas.buscar([id(1), id(40)])).toEqual([
      { evaluador: 'A', idEnvio: id(1), grupo: 'z' },
      { evaluador: 'B', idEnvio: id(1), grupo: 'y' },
    ]);
    expect(await etiquetas.buscar([])).toEqual([]);
    expect(await verificaciones.listar()).toEqual([
      { ...verificacion, resultado: 'REAL', finEn: minutos(5), registradaEn: minutos(20) },
    ]);
    await expect(
      db.execute(
        sql`insert into evaluacion_verificaciones values (${id(2)}, 'FALSO', now(), 'CAMPO', null, now())`,
      ),
    ).rejects.toThrow();
  });

  it('HU-14: los envíos para etiquetar y los reportes para verificar son de la comunidad, del periodo y no rechazados', async () => {
    const envio = (n: number, cambios = {}) =>
      registro.registrarEnvio({
        idEnvio: id(n),
        tipo: 'CREADO',
        idReporte: id(n),
        codigoCategoria: 'jauria',
        publicLocation: { latitud: -16.45, longitud: -68.2 },
        fuenteOficial: null,
        recibidoEn: minutos(5000 + n),
        ...cambios,
      });
    await envio(70);
    await envio(71, { tipo: 'DUPLICADO', idReporte: id(70) });
    await envio(72, { fuenteOficial: 'ABC' });
    await envio(73);
    await envio(74);
    for (const [evento, n, estado] of [
      [170, 70, 'CONFIRMADO'],
      [173, 73, 'RECHAZADO'],
    ] as const) {
      await registro.registrarTransicion({
        idEvento: id(evento),
        idReporte: id(n),
        estado,
        caducaEn: estado === 'CONFIRMADO' ? minutos(6000) : null,
        ocurridoEn: minutos(5100),
      });
    }
    const [desde, hasta] = [minutos(5070), minutos(5080)];

    const etiquetables = await registro.buscarEnviosEtiquetables(desde, hasta);
    const verificables = await registro.buscarReportesVerificables(desde, hasta);

    expect(etiquetables.map((e) => e.idEnvio)).toEqual([id(70), id(71), id(74)]);
    expect(etiquetables[0]).toEqual({
      idEnvio: id(70),
      codigoCategoria: 'jauria',
      publicLocation: { latitud: -16.45, longitud: -68.2 },
      recibidoEn: minutos(5070),
    });
    expect(verificables.map((r) => [r.idReporte, r.confirmado])).toEqual([
      [id(70), true],
      [id(74), false],
    ]);
  });

  it('HU-14: la exportación trae cada tabla con las columnas del contrato y las horas en ISO 8601', async () => {
    const exportacion = await new RepositorioExportacionPg(db).exportar();

    for (const [tabla, columnas] of Object.entries(COLUMNAS_EXPORTADAS)) {
      const filas = exportacion[tabla as keyof typeof COLUMNAS_EXPORTADAS];
      expect(filas.length, tabla).toBeGreaterThan(0);
      expect(Object.keys(filas[0]!).toSorted(), tabla).toEqual([...columnas].toSorted());
    }
    expect(exportacion.envios[0]!['recibido_en']).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(exportacion.tareas[0]).toMatchObject({
      codigo_participante: 'P01',
      iniciada_en: minutos(0).toISOString(),
    });
    expect(JSON.stringify(exportacion)).not.toMatch(/id_autor|id_votante|ubicacion"/);
  });

  it('las migraciones se revierten sin dejar tablas ni la función del disparador', async () => {
    expect(await revertirUltima(db, migraciones)).toBe('0002_herramientas');
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
