import { crearDb, migrarTodo, migracionesDePlataforma, revertirUltima } from '@gis/platform';
import type { Db } from '@gis/platform';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioDatosAbiertosPg } from '../adapters/repositorio-datos-abiertos-pg.js';
import { huellaDe } from '../application/registrar-dato-abierto.js';
import { anonimizar } from '../domain/dato-abierto.js';
import { openDataModulo } from '../index.js';
import { reporteFinalizado } from './dobles.js';

const migraciones = openDataModulo.migraciones!;
const id = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;

describeIntegration('datos abiertos en PostGIS', () => {
  let base: TestDatabase;
  let db: Db;
  let datos: RepositorioDatosAbiertosPg;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);
    datos = new RepositorioDatosAbiertosPg(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-11: guarda una vez cada reporte y lista solo columnas públicas', async () => {
    const dato = anonimizar(reporteFinalizado(), huellaDe(id(1)));

    expect(await datos.guardar(dato)).toBe(true);
    expect(await datos.guardar(dato)).toBe(false);

    expect(await datos.listar()).toEqual([
      {
        codigoCategoria: 'bloqueo',
        celda: dato.celda,
        hora: new Date('2026-10-19T14:00:00.000Z'),
        estadoFinal: 'RESUELTO',
        fueConfirmado: true,
      },
    ]);
  });

  it('HU-11: la tabla no tiene columnas de usuario, punto, descripción ni ID', async () => {
    const { rows } = await db.execute(
      sql`select column_name from information_schema.columns
          where table_name = 'datos_abiertos_reportes' order by column_name`,
    );

    expect(rows.map((r) => r.column_name)).toEqual([
      'celda_latitud',
      'celda_longitud',
      'codigo_categoria',
      'estado_final',
      'fue_confirmado',
      'hora',
      'huella',
    ]);
  });

  it('HU-11: resume por categoría, por hora de La Paz y con la cantidad de confirmados', async () => {
    // 14:37 UTC son las 10 en La Paz (UTC-4); 02:10 UTC, las 22 del día anterior.
    await datos.guardar(
      anonimizar(reporteFinalizado({ codigoCategoria: 'robo', extensiones: 0 }), huellaDe(id(2))),
    );
    await datos.guardar(
      anonimizar(
        reporteFinalizado({
          codigoCategoria: 'robo',
          estado: 'CADUCADO',
          creadoEn: new Date('2026-10-20T02:10:00Z'),
        }),
        huellaDe(id(3)),
      ),
    );

    const resumen = await datos.resumir();

    expect(resumen).toMatchObject({
      total: 3,
      confirmados: 2,
      porCategoria: [
        { codigoCategoria: 'robo', cantidad: 2 },
        { codigoCategoria: 'bloqueo', cantidad: 1 },
      ],
      desde: new Date('2026-10-19T14:00:00Z'),
      hasta: new Date('2026-10-20T02:00:00Z'),
    });
    expect(resumen.porHoraDelDia).toHaveLength(24);
    expect(resumen.porHoraDelDia[10]).toBe(2);
    expect(resumen.porHoraDelDia[22]).toBe(1);
  });

  it.each<[string, SQL]>([
    [
      'una hora con minutos',
      sql`update datos_abiertos_reportes set hora = hora + interval '5 minutes'`,
    ],
    ['un estado no final', sql`update datos_abiertos_reportes set estado_final = 'ACTIVO'`],
    ['una huella que no es SHA-256', sql`update datos_abiertos_reportes set huella = 'abc'`],
  ])('la base de datos rechaza %s', async (_caso, sentencia) => {
    await expect(db.execute(sentencia)).rejects.toThrow();
  });

  it('las migraciones se revierten y se vuelven a aplicar', async () => {
    expect(await revertirUltima(db, migraciones)).toBe('0000_datos_abiertos');
    await migrarTodo(db, [migracionesDePlataforma, migraciones]);

    expect((await datos.resumir()).total).toBe(0);
  });
});
