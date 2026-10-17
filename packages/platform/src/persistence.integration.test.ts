import type { EventoDeIntegracion } from '@gis/contracts';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  agregarASalida,
  crearDb,
  migrarTodo,
  migrarAvance,
  tablaDeMigraciones,
  migracionesDePlataforma,
  revertirUltima,
} from './index.js';
import type { Db } from './index.js';

const evento = (id: string, ocurridoEn = '2026-10-12T12:00:00.000Z'): EventoDeIntegracion => ({
  id,
  tipo: 'ReporteCreado',
  version: 1,
  ocurridoEn: ocurridoEn,
  contenido: { idReporte: id },
});

const ID_1 = '11111111-1111-4111-8111-111111111111';
const ID_2 = '22222222-2222-4222-8222-222222222222';

describeIntegration('migraciones de la plataforma', () => {
  let base: TestDatabase;
  let db: Db;

  const existe = async (tabla: string): Promise<boolean> => {
    const { rows } = await db.execute(sql`select to_regclass(${`public.${tabla}`}) as oid`);
    return rows[0]?.oid !== null;
  };
  const aplicadas = async (): Promise<number> => {
    const historial = sql.raw(`"drizzle"."${tablaDeMigraciones(migracionesDePlataforma)}"`);
    const { rows } = await db.execute(sql`select count(*)::int as total from ${historial}`);
    return Number(rows[0]?.total);
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('sobre una base vacía crea PostGIS, el outbox y la bandeja de entrada', async () => {
    await migrarAvance(db, migracionesDePlataforma);

    const { rows } = await db.execute(sql`select postgis_lib_version() as version`);
    expect(String(rows[0]?.version)).toMatch(/^3\./);
    expect(await existe('eventos_salida')).toBe(true);
    expect(await existe('eventos_procesados')).toBe(true);
    expect(await aplicadas()).toBe(3);
  });

  it('volver a aplicarlas no tiene efecto', async () => {
    await migrarTodo(db, [migracionesDePlataforma]);

    expect(await aplicadas()).toBe(3);
  });

  it('revierte la última migración y la quita del historial', async () => {
    expect(await revertirUltima(db, migracionesDePlataforma)).toBe('0002_entrega_de_eventos');

    expect(await existe('eventos_procesados')).toBe(false);
    expect(await existe('eventos_salida')).toBe(true);
    expect(await aplicadas()).toBe(2);
  });

  it('tras revertir, aplicar de nuevo deja el mismo esquema', async () => {
    await migrarAvance(db, migracionesDePlataforma);

    expect(await existe('eventos_procesados')).toBe(true);
    expect(await aplicadas()).toBe(3);
  });

  it('revertir todo deja la base sin migraciones y avisa cuando no queda ninguna', async () => {
    expect(await revertirUltima(db, migracionesDePlataforma)).toBe('0002_entrega_de_eventos');
    expect(await revertirUltima(db, migracionesDePlataforma)).toBe('0001_eventos_salida');
    expect(await revertirUltima(db, migracionesDePlataforma)).toBe('0000_postgis');
    expect(await revertirUltima(db, migracionesDePlataforma)).toBeNull();

    await migrarAvance(db, migracionesDePlataforma);
  });
});

describeIntegration('outbox', () => {
  let base: TestDatabase;
  let db: Db;

  const guardados = async () => {
    const { rows } = await db.execute(
      sql`select id, tipo, contenido, publicado_en from eventos_salida order by creado_en`,
    );
    return rows;
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarAvance(db, migracionesDePlataforma);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('guarda los eventos pendientes de publicar, con su clave y su contenido', async () => {
    await agregarASalida(db, [
      evento(ID_1, '2026-10-12T12:00:00.000Z'),
      evento(ID_2, '2026-10-12T12:00:01.000Z'),
    ]);

    expect(await guardados()).toEqual([
      { id: ID_1, tipo: 'ReporteCreado.v1', contenido: evento(ID_1), publicado_en: null },
      {
        id: ID_2,
        tipo: 'ReporteCreado.v1',
        contenido: evento(ID_2, '2026-10-12T12:00:01.000Z'),
        publicado_en: null,
      },
    ]);
  });

  it('no hace nada si no hay eventos', async () => {
    await expect(agregarASalida(db, [])).resolves.toBeUndefined();

    expect(await guardados()).toHaveLength(2);
  });

  it('dentro de una transacción que falla no queda ningún evento', async () => {
    const ID_3 = '33333333-3333-4333-8333-333333333333';

    await expect(
      db.transaction(async (tx) => {
        await agregarASalida(tx, [evento(ID_3)]);
        throw new Error('falló el resto de la unidad de trabajo');
      }),
    ).rejects.toThrow('falló el resto');

    expect(await guardados()).toHaveLength(2);
  });

  it('la base de datos rechaza un evento repetido', async () => {
    await expect(agregarASalida(db, [evento(ID_1)])).rejects.toThrow();
  });
});
