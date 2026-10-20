import type { EventoDeIntegracion } from '@gis/contracts';
import {
  agregarASalida,
  crearDb,
  migrarTodo,
  migracionesDePlataforma,
  revertirUltima,
} from '@gis/platform';
import type { Db } from '@gis/platform';
import { codigoCategoria, PuntoGeo, idReporte, idUsuario } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioCategoriasPg } from '../adapters/category-repository.js';
import { RepositorioReportesPostgis } from '../adapters/report-repository.js';
import { UnidadDeTrabajoReportePg } from '../adapters/report-unit-of-work.js';
import { CATEGORIAS_MVP } from '../domain/category.js';
import type { Categoria } from '../domain/category.js';
import { Reporte } from '../domain/report.js';
import { reportsModulo } from '../index.js';

const migraciones = reportsModulo.migraciones!;
const autor = idUsuario('11111111-1111-4111-8111-111111111111');
const creado = new Date('2026-10-12T12:00:00.000Z');
const minutosDespues = (minutos: number) => new Date(creado.getTime() + minutos * 60_000);
const plazaMurillo = PuntoGeo.crear(-16.4955, -68.1336);

const categoria = (codigo: string): Categoria => CATEGORIAS_MVP.find((c) => c.codigo === codigo)!;

let secuencia = 0;
/** Reporte nuevo con identificador y clave de idempotencia únicos. */
function nuevoReporte(codigo = 'accidente'): Reporte {
  secuencia += 1;
  const sufijo = String(secuencia).padStart(12, '0');
  return Reporte.crear({
    id: idReporte(`aaaaaaaa-aaaa-4aaa-8aaa-${sufijo}`),
    categoria: categoria(codigo),
    authorId: autor,
    location: plazaMurillo,
    idempotencyKey: `clave-${sufijo}`,
    ahora: creado,
  });
}

const evento = (id: string): EventoDeIntegracion => ({
  id,
  tipo: 'ReporteCreado',
  version: 1,
  ocurridoEn: creado.toISOString(),
  contenido: {},
});

describeIntegration('persistencia de reports', () => {
  let base: TestDatabase;
  let db: Db;
  let reportes: RepositorioReportesPostgis;

  const contar = async (tabla: string): Promise<number> => {
    const { rows } = await db.execute(sql.raw(`select count(*)::int as total from ${tabla}`));
    return Number(rows[0]?.total);
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    reportes = new RepositorioReportesPostgis(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('la semilla coincide con el catálogo de categorías del dominio', async () => {
    const guardadas = await new RepositorioCategoriasPg(db).buscarTodas();

    const porCodigo = [...CATEGORIAS_MVP].sort((a, b) => a.codigo.localeCompare(b.codigo));
    expect(guardadas).toEqual(porCodigo);
  });

  it('busca una categoría por su código', async () => {
    const categorias = new RepositorioCategoriasPg(db);

    expect(await categorias.buscarPorCodigo(codigoCategoria('robo'))).toEqual(categoria('robo'));
    expect(await categorias.buscarPorCodigo(codigoCategoria('inexistente'))).toBeNull();
  });

  it('guarda un reporte y lo recupera sin pérdida', async () => {
    const reporte = nuevoReporte('bloqueo');

    await reportes.guardar(reporte);
    const recuperado = (await reportes.buscarPorId(reporte.id))!;

    expect(recuperado).toMatchObject({
      id: reporte.id,
      codigoCategoria: 'bloqueo',
      authorId: autor,
      estado: 'ACTIVO',
      ttlMinutos: 360,
      creadoEn: creado,
      caducaEn: minutosDespues(360),
      extensiones: 0,
      motivoRechazo: null,
      descripcion: null,
      idempotencyKey: reporte.idempotencyKey,
    });
    expect(recuperado.location.esIgualA(plazaMurillo)).toBe(true);
    expect(recuperado.publicLocation.esIgualA(plazaMurillo)).toBe(true);
    expect(recuperado.extraerEventos()).toEqual([]);
  });

  it('RNF-14: guarda por separado la ubicación real y la pública que decidió el dominio', async () => {
    const robo = nuevoReporte('robo');

    await reportes.guardar(robo);
    const recuperado = (await reportes.buscarPorId(robo.id))!;

    expect(recuperado.location.esIgualA(plazaMurillo)).toBe(true);
    expect(recuperado.publicLocation.esIgualA(robo.publicLocation)).toBe(true);
    expect(recuperado.publicLocation.esIgualA(plazaMurillo)).toBe(false);
  });

  it('las ubicaciones se guardan como puntos WGS84', async () => {
    const { rows } = await db.execute(
      sql`select distinct st_srid(ubicacion) as real, st_srid(ubicacion_publica) as publica,
                 geometrytype(ubicacion) as tipo from reportes`,
    );

    expect(rows).toEqual([{ real: 4326, publica: 4326, tipo: 'POINT' }]);
  });

  it('guarda cada cambio del ciclo de vida', async () => {
    const reporte = nuevoReporte('accidente');
    await reportes.guardar(reporte);

    reporte.marcarConfirmado(minutosDespues(10));
    await reportes.guardar(reporte);
    expect(await reportes.buscarPorId(reporte.id)).toMatchObject({
      estado: 'CONFIRMADO',
      extensiones: 1,
      caducaEn: minutosDespues(270),
    });

    reporte.rechazar('MODERACION', minutosDespues(20));
    await reportes.guardar(reporte);
    expect(await reportes.buscarPorId(reporte.id)).toMatchObject({
      estado: 'RECHAZADO',
      motivoRechazo: 'MODERACION',
    });
  });

  it('HU-05: encuentra un reporte por su clave de idempotencia', async () => {
    const reporte = nuevoReporte();
    await reportes.guardar(reporte);

    expect((await reportes.buscarPorClaveDeIdempotencia(reporte.idempotencyKey))?.id).toBe(
      reporte.id,
    );
    expect(await reportes.buscarPorClaveDeIdempotencia('clave-desconocida')).toBeNull();
  });

  it('HU-05: la base de datos rechaza una clave de idempotencia repetida', async () => {
    const original = nuevoReporte();
    await reportes.guardar(original);
    const repetido = Reporte.crear({
      id: idReporte('bbbbbbbb-bbbb-4bbb-8bbb-000000000001'),
      categoria: categoria('accidente'),
      authorId: autor,
      location: plazaMurillo,
      idempotencyKey: original.idempotencyKey,
      ahora: creado,
    });

    await expect(reportes.guardar(repetido)).rejects.toThrow();
    expect(await reportes.buscarPorId(repetido.id)).toBeNull();
  });

  it.each([
    ['un estado inválido', sql`update reportes set estado = 'BORRADO'`],
    ['más de dos extensiones', sql`update reportes set extensiones = 3`],
    ['un motivo de rechazo desconocido', sql`update reportes set motivo_rechazo = 'PORQUE_SI'`],
    ['una categoría inexistente', sql`update reportes set codigo_categoria = 'ovni'`],
    [
      'una ubicación con otro sistema de referencia',
      sql`update reportes set ubicacion = st_setsrid(st_makepoint(0, 0), 3857)`,
    ],
    ['una categoría con TTL de cero', sql`update categorias set ttl_minutos = 0`],
    ['una descripción vacía', sql`update reportes set descripcion = ''`],
    [
      'una descripción de más de 280 caracteres',
      sql`update reportes set descripcion = repeat('a', 281)`,
    ],
  ])('la base de datos rechaza %s', async (_caso, sentencia) => {
    await expect(db.execute(sentencia)).rejects.toThrow();
  });

  it('las consultas de vigentes y las espaciales tienen sus índices', async () => {
    const { rows } = await db.execute(
      sql`select indexname from pg_indexes where tablename = 'reportes' order by indexname`,
    );

    expect(rows.map((fila) => fila.indexname)).toEqual([
      'reportes_autor_creado_en_idx',
      'reportes_clave_idempotencia_unique',
      'reportes_creado_en_idx',
      'reportes_pkey',
      'reportes_ubicacion_geography_idx',
      'reportes_ubicacion_publica_idx',
      'reportes_vigentes_idx',
    ]);
  });

  it('HU-10: guarda la descripción que se agrega después de crear el reporte', async () => {
    const reporte = nuevoReporte();
    await reportes.guardar(reporte);

    reporte.agregarDescripcion('Semáforo apagado 🚦', autor, creado);
    await reportes.guardar(reporte);

    expect((await reportes.buscarPorId(reporte.id))?.descripcion).toBe('Semáforo apagado 🚦');
  });

  it('HU-12: busca varios reportes por su ID y omite los que no existen', async () => {
    const [a, b] = [nuevoReporte(), nuevoReporte()];
    await reportes.guardar(a);
    await reportes.guardar(b);

    const encontrados = await reportes.buscarPorIds([
      a.id,
      b.id,
      idReporte('ffffffff-ffff-4fff-8fff-ffffffffffff'),
    ]);

    expect(encontrados.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    expect(await reportes.buscarPorIds([])).toEqual([]);
  });

  it('HU-10: cuenta los reportes de un autor en un intervalo, en cualquier estado', async () => {
    const otroAutor = idUsuario('99999999-9999-4999-8999-999999999999');
    const enRafaga = [0, 10, 20].map((minutos) => {
      secuencia += 1;
      const sufijo = String(secuencia).padStart(12, '0');
      return Reporte.crear({
        id: idReporte(`eeeeeeee-aaaa-4aaa-8aaa-${sufijo}`),
        categoria: categoria('accidente'),
        authorId: otroAutor,
        location: plazaMurillo,
        idempotencyKey: `rafaga-${sufijo}`,
        ahora: minutosDespues(minutos),
      });
    });
    enRafaga[1]!.rechazar('MODERACION', minutosDespues(15));
    for (const reporte of enRafaga) await reportes.guardar(reporte);

    expect(await reportes.contarDelAutor(otroAutor, creado, minutosDespues(20))).toBe(3);
    expect(await reportes.contarDelAutor(otroAutor, minutosDespues(5), minutosDespues(60))).toBe(2);
    expect(await reportes.contarDelAutor(otroAutor, minutosDespues(21), minutosDespues(60))).toBe(
      0,
    );
  });

  it('la unidad de trabajo guarda el reporte y su evento juntos', async () => {
    const reporte = nuevoReporte();
    const antes = await contar('eventos_salida');

    await new UnidadDeTrabajoReportePg(db).confirmar(reporte, [
      evento('cccccccc-cccc-4ccc-8ccc-000000000001'),
    ]);

    expect(await reportes.buscarPorId(reporte.id)).not.toBeNull();
    expect(await contar('eventos_salida')).toBe(antes + 1);
  });

  it('atomicidad: si falla la escritura del evento, el reporte tampoco se guarda', async () => {
    const idRepetido = 'cccccccc-cccc-4ccc-8ccc-000000000002';
    await agregarASalida(db, [evento(idRepetido)]);
    const reporte = nuevoReporte();
    const antes = await contar('eventos_salida');

    await expect(
      new UnidadDeTrabajoReportePg(db).confirmar(reporte, [evento(idRepetido)]),
    ).rejects.toThrow();

    expect(await reportes.buscarPorId(reporte.id)).toBeNull();
    expect(await contar('eventos_salida')).toBe(antes);
  });

  it('HU-05: la unidad de trabajo traduce una clave de idempotencia repetida a un conflicto', async () => {
    const original = nuevoReporte();
    const unidad = new UnidadDeTrabajoReportePg(db);
    await unidad.confirmar(original, []);
    const repetido = Reporte.crear({
      id: idReporte('bbbbbbbb-bbbb-4bbb-8bbb-000000000002'),
      categoria: categoria('accidente'),
      authorId: autor,
      location: plazaMurillo,
      idempotencyKey: original.idempotencyKey,
      ahora: creado,
    });

    await expect(unidad.confirmar(repetido, [])).rejects.toMatchObject({
      tipo: 'CONFLICTO',
      codigo: 'CLAVE_DE_IDEMPOTENCIA_REPETIDA',
    });
  });

  it('HU-05: dos envíos simultáneos del mismo reporte dejan uno solo', async () => {
    const clave = 'simultaneo-0001';
    const envio = (sufijo: string) =>
      Reporte.crear({
        id: idReporte(`dddddddd-dddd-4ddd-8ddd-${sufijo}`),
        categoria: categoria('accidente'),
        authorId: autor,
        location: plazaMurillo,
        idempotencyKey: clave,
        ahora: creado,
      });
    const unidad = new UnidadDeTrabajoReportePg(db);

    const resultados = await Promise.allSettled([
      unidad.confirmar(envio('000000000001'), []),
      unidad.confirmar(envio('000000000002'), []),
    ]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { codigo: 'CLAVE_DE_IDEMPOTENCIA_REPETIDA' },
    });
  });

  it('la unidad de trabajo guarda eventos sin reporte (un duplicado)', async () => {
    const antes = await contar('eventos_salida');

    await new UnidadDeTrabajoReportePg(db).registrarEventos([
      evento('cccccccc-cccc-4ccc-8ccc-000000000003'),
    ]);

    expect(await contar('eventos_salida')).toBe(antes + 1);
  });
});

describeIntegration('migraciones de reports', () => {
  let base: TestDatabase;
  let db: Db;

  const tablas = async (): Promise<string[]> => {
    const { rows } = await db.execute(
      sql`select tablename from pg_tables where schemaname = 'public'
          and tablename in ('categorias', 'reportes') order by tablename`,
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

  it('se aplican sobre una base vacía y se revierten por completo', async () => {
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    expect(await tablas()).toEqual(['categorias', 'reportes']);

    expect(await revertirUltima(db, migraciones)).toBe('0004_indice_autor');

    expect(await revertirUltima(db, migraciones)).toBe('0003_descripcion_reporte');

    expect(await revertirUltima(db, migraciones)).toBe('0002_indices_de_consulta');

    expect(await revertirUltima(db, migraciones)).toBe('0001_semilla_categorias');
    expect(await new RepositorioCategoriasPg(db).buscarTodas()).toEqual([]);

    expect(await revertirUltima(db, migraciones)).toBe('0000_categorias_reportes');
    expect(await tablas()).toEqual([]);
  });

  it('tras revertir, aplicarlas de nuevo deja el mismo esquema y la semilla', async () => {
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);

    expect(await tablas()).toEqual(['categorias', 'reportes']);
    expect(await new RepositorioCategoriasPg(db).buscarTodas()).toHaveLength(5);
  });
});
