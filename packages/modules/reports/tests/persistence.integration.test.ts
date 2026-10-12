import type { IntegrationEvent } from '@gis/contracts';
import {
  appendToOutbox,
  createDb,
  migrateAll,
  platformMigrations,
  revertLast,
} from '@gis/platform';
import type { Db } from '@gis/platform';
import { categoryCode, GeoPoint, reportId, userId } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PgCategoryRepository } from '../adapters/category-repository.js';
import { PostgisReportRepository } from '../adapters/report-repository.js';
import { PgReportUnitOfWork } from '../adapters/report-unit-of-work.js';
import { MVP_CATEGORIES } from '../domain/category.js';
import type { Category } from '../domain/category.js';
import { Report } from '../domain/report.js';
import { reportsModule } from '../index.js';

const migraciones = reportsModule.migrations!;
const autor = userId('11111111-1111-4111-8111-111111111111');
const creado = new Date('2026-10-12T12:00:00.000Z');
const minutosDespues = (minutos: number) => new Date(creado.getTime() + minutos * 60_000);
const plazaMurillo = GeoPoint.create(-16.4955, -68.1336);

const categoria = (codigo: string): Category => MVP_CATEGORIES.find((c) => c.code === codigo)!;

let secuencia = 0;
/** Reporte nuevo con identificador y clave de idempotencia únicos. */
function nuevoReporte(codigo = 'accidente'): Report {
  secuencia += 1;
  const sufijo = String(secuencia).padStart(12, '0');
  return Report.create({
    id: reportId(`aaaaaaaa-aaaa-4aaa-8aaa-${sufijo}`),
    category: categoria(codigo),
    authorId: autor,
    location: plazaMurillo,
    idempotencyKey: `clave-${sufijo}`,
    now: creado,
  });
}

const evento = (id: string): IntegrationEvent => ({
  id,
  type: 'ReportCreated',
  version: 1,
  occurredAt: creado.toISOString(),
  payload: {},
});

describeIntegration('persistencia de reports', () => {
  let base: TestDatabase;
  let db: Db;
  let reportes: PostgisReportRepository;

  const contar = async (tabla: string): Promise<number> => {
    const { rows } = await db.execute(sql.raw(`select count(*)::int as total from ${tabla}`));
    return Number(rows[0]?.total);
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = createDb(base.pool);
    await migrateAll(db, [platformMigrations, migraciones]);
    reportes = new PostgisReportRepository(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('la semilla coincide con el catálogo de categorías del dominio', async () => {
    const guardadas = await new PgCategoryRepository(db).findAll();

    const porCodigo = [...MVP_CATEGORIES].sort((a, b) => a.code.localeCompare(b.code));
    expect(guardadas).toEqual(porCodigo);
  });

  it('busca una categoría por su código', async () => {
    const categorias = new PgCategoryRepository(db);

    expect(await categorias.findByCode(categoryCode('robo'))).toEqual(categoria('robo'));
    expect(await categorias.findByCode(categoryCode('inexistente'))).toBeNull();
  });

  it('guarda un reporte y lo recupera sin pérdida', async () => {
    const reporte = nuevoReporte('bloqueo');

    await reportes.save(reporte);
    const recuperado = (await reportes.findById(reporte.id))!;

    expect(recuperado).toMatchObject({
      id: reporte.id,
      categoryCode: 'bloqueo',
      authorId: autor,
      status: 'ACTIVO',
      ttlMinutes: 360,
      createdAt: creado,
      expiresAt: minutosDespues(360),
      extensions: 0,
      rejectionReason: null,
      idempotencyKey: reporte.idempotencyKey,
    });
    expect(recuperado.location.equals(plazaMurillo)).toBe(true);
    expect(recuperado.publicLocation.equals(plazaMurillo)).toBe(true);
    expect(recuperado.pullEvents()).toEqual([]);
  });

  it('RNF-14: guarda por separado la ubicación real y la pública que decidió el dominio', async () => {
    const robo = nuevoReporte('robo');

    await reportes.save(robo);
    const recuperado = (await reportes.findById(robo.id))!;

    expect(recuperado.location.equals(plazaMurillo)).toBe(true);
    expect(recuperado.publicLocation.equals(robo.publicLocation)).toBe(true);
    expect(recuperado.publicLocation.equals(plazaMurillo)).toBe(false);
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
    await reportes.save(reporte);

    reporte.markConfirmed(minutosDespues(10));
    await reportes.save(reporte);
    expect(await reportes.findById(reporte.id)).toMatchObject({
      status: 'CONFIRMADO',
      extensions: 1,
      expiresAt: minutosDespues(270),
    });

    reporte.reject('MODERACION', minutosDespues(20));
    await reportes.save(reporte);
    expect(await reportes.findById(reporte.id)).toMatchObject({
      status: 'RECHAZADO',
      rejectionReason: 'MODERACION',
    });
  });

  it('HU-05: encuentra un reporte por su clave de idempotencia', async () => {
    const reporte = nuevoReporte();
    await reportes.save(reporte);

    expect((await reportes.findByIdempotencyKey(reporte.idempotencyKey))?.id).toBe(reporte.id);
    expect(await reportes.findByIdempotencyKey('clave-desconocida')).toBeNull();
  });

  it('HU-05: la base de datos rechaza una clave de idempotencia repetida', async () => {
    const original = nuevoReporte();
    await reportes.save(original);
    const repetido = Report.create({
      id: reportId('bbbbbbbb-bbbb-4bbb-8bbb-000000000001'),
      category: categoria('accidente'),
      authorId: autor,
      location: plazaMurillo,
      idempotencyKey: original.idempotencyKey,
      now: creado,
    });

    await expect(reportes.save(repetido)).rejects.toThrow();
    expect(await reportes.findById(repetido.id)).toBeNull();
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
  ])('la base de datos rechaza %s', async (_caso, sentencia) => {
    await expect(db.execute(sentencia)).rejects.toThrow();
  });

  it('las consultas de vigentes y las espaciales tienen sus índices', async () => {
    const { rows } = await db.execute(
      sql`select indexname from pg_indexes where tablename = 'reportes' order by indexname`,
    );

    expect(rows.map((fila) => fila.indexname)).toEqual([
      'reportes_clave_idempotencia_unique',
      'reportes_pkey',
      'reportes_ubicacion_idx',
      'reportes_ubicacion_publica_idx',
      'reportes_vigentes_idx',
    ]);
  });

  it('la unidad de trabajo guarda el reporte y su evento juntos', async () => {
    const reporte = nuevoReporte();
    const antes = await contar('eventos_salida');

    await new PgReportUnitOfWork(db).commit(reporte, [
      evento('cccccccc-cccc-4ccc-8ccc-000000000001'),
    ]);

    expect(await reportes.findById(reporte.id)).not.toBeNull();
    expect(await contar('eventos_salida')).toBe(antes + 1);
  });

  it('atomicidad: si falla la escritura del evento, el reporte tampoco se guarda', async () => {
    const idRepetido = 'cccccccc-cccc-4ccc-8ccc-000000000002';
    await appendToOutbox(db, [evento(idRepetido)]);
    const reporte = nuevoReporte();
    const antes = await contar('eventos_salida');

    await expect(
      new PgReportUnitOfWork(db).commit(reporte, [evento(idRepetido)]),
    ).rejects.toThrow();

    expect(await reportes.findById(reporte.id)).toBeNull();
    expect(await contar('eventos_salida')).toBe(antes);
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
    db = createDb(base.pool);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('se aplican sobre una base vacía y se revierten por completo', async () => {
    await migrateAll(db, [platformMigrations, migraciones]);
    expect(await tablas()).toEqual(['categorias', 'reportes']);

    expect(await revertLast(db, migraciones)).toBe('0001_semilla_categorias');
    expect(await new PgCategoryRepository(db).findAll()).toEqual([]);

    expect(await revertLast(db, migraciones)).toBe('0000_categorias_reportes');
    expect(await tablas()).toEqual([]);
  });

  it('tras revertir, aplicarlas de nuevo deja el mismo esquema y la semilla', async () => {
    await migrateAll(db, [platformMigrations, migraciones]);

    expect(await tablas()).toEqual(['categorias', 'reportes']);
    expect(await new PgCategoryRepository(db).findAll()).toHaveLength(5);
  });
});
