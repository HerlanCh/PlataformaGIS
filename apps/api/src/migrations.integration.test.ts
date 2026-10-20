import { crearDb, cargarInterruptores, migrarTodo } from '@gis/platform';
import type { Db } from '@gis/platform';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { conjuntosDeMigraciones } from './migrations.js';
import { modulos } from './modules.generated.js';

const TODOS_ENCENDIDOS = Object.fromEntries(
  modulos.map(({ nombre: name }) => [`FEATURE_${name.toUpperCase().replaceAll('-', '_')}`, 'true']),
);

const TABLAS_IMPRESCINDIBLES = [
  'categorias',
  'eventos_procesados',
  'eventos_salida',
  'reportes',
  'reputaciones',
  'usuarios',
  'votos',
];

describeIntegration('migraciones de toda la plataforma', () => {
  let base: TestDatabase;
  let db: Db;

  const migrar = (env: Record<string, string>) =>
    migrarTodo(db, conjuntosDeMigraciones(cargarInterruptores(env), modulos));

  const tablas = async (): Promise<string[]> => {
    const { rows } = await db.execute(
      sql`select tablename from pg_tables where schemaname = 'public'
          and tablename <> 'spatial_ref_sys' order by tablename`,
    );
    return rows.map((fila) => String(fila.tablename));
  };

  beforeEach(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
  });

  afterEach(async () => {
    await base?.close();
  });

  it('con todos los módulos encendidos crea el esquema completo desde cero', async () => {
    await migrar(TODOS_ENCENDIDOS);

    expect(await tablas()).toEqual(
      [
        ...TABLAS_IMPRESCINDIBLES,
        'acciones_moderacion',
        'clasificaciones',
        'cola_moderacion',
        'suscripciones_push',
        'zonas_suscritas',
      ].sort(),
    );
  });

  it('repetir la migración no cambia nada', async () => {
    await migrar(TODOS_ENCENDIDOS);
    const antes = await tablas();

    await migrar(TODOS_ENCENDIDOS);

    expect(await tablas()).toEqual(antes);
  });

  it('sin interruptores solo crea las tablas de los módulos imprescindibles', async () => {
    await migrar({});

    expect(await tablas()).toEqual(TABLAS_IMPRESCINDIBLES);
  });

  it('con FEATURE_SUBSCRIPTIONS=false no crea su tabla y el resto queda completo', async () => {
    await migrar({ ...TODOS_ENCENDIDOS, FEATURE_SUBSCRIPTIONS: 'false' });

    expect(await tablas()).toEqual(
      [
        ...TABLAS_IMPRESCINDIBLES,
        'acciones_moderacion',
        'clasificaciones',
        'cola_moderacion',
        'suscripciones_push',
      ].sort(),
    );
  });

  it('encender un módulo más tarde añade solo sus tablas', async () => {
    await migrar({ ...TODOS_ENCENDIDOS, FEATURE_SUBSCRIPTIONS: 'false' });

    await migrar(TODOS_ENCENDIDOS);

    expect(await tablas()).toContain('zonas_suscritas');
  });
});
