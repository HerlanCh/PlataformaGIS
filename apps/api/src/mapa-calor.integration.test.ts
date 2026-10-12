import { ConsultaMapaCalorPg } from '@gis/module-heatmap';
import { reportsModulo } from '@gis/module-reports';
import { crearDb, migracionesDePlataforma, migrarTodo } from '@gis/platform';
import type { Db } from '@gis/platform';
import { AREA_DE_SERVICIO } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';

/**
 * ADR-003: `heatmap` lee la tabla `reportes` de `reports` sin importar su código. Esta prueba
 * une ambos módulos con las migraciones reales: si `reports` renombra una de las columnas que
 * lee el mapa de calor, falla aquí aunque las pruebas de cada módulo sigan en verde.
 */
describeIntegration('mapa de calor sobre el esquema real de reports', () => {
  let base: TestDatabase;
  let db: Db;

  const insertar = async (n: number, estado: string, longitud: number) => {
    const sufijo = String(n).padStart(12, '0');
    await db.execute(sql`
      insert into reportes (id, codigo_categoria, id_autor, estado, ttl_minutos, extensiones,
        motivo_rechazo, creado_en, caduca_en, ubicacion, ubicacion_publica, clave_idempotencia)
      values (
        ${`aaaaaaaa-aaaa-4aaa-8aaa-${sufijo}`}, 'bloqueo', '11111111-1111-4111-8111-111111111111',
        ${estado}, 360, 0, ${estado === 'RECHAZADO' ? 'MODERACION' : null},
        '2026-10-12T12:00:00Z', '2026-10-12T18:00:00Z',
        st_setsrid(st_makepoint(-68.2, -16.6), 4326),
        st_setsrid(st_makepoint(${longitud}, -16.4955), 4326),
        ${`clave-calor-${sufijo}`}
      )
    `);
  };

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, reportsModulo.migraciones!]);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-06: agrega por la ubicación pública, respeta el umbral y omite los rechazados', async () => {
    // Tres reportes en una celda, dos en otra, y un rechazado que completaría la segunda.
    await insertar(1, 'ACTIVO', -68.1336);
    await insertar(2, 'CONFIRMADO', -68.13361);
    await insertar(3, 'CADUCADO', -68.13362);
    await insertar(4, 'ACTIVO', -68.1);
    await insertar(5, 'RESUELTO', -68.10001);
    await insertar(6, 'RECHAZADO', -68.10002);

    const celdas = await new ConsultaMapaCalorPg(db).agregar({
      caja: AREA_DE_SERVICIO,
      tamanoCeldaM: 500,
      desde: new Date('2026-10-01T00:00:00Z'),
      hasta: new Date('2026-10-31T00:00:00Z'),
      categorias: [],
    });

    expect(celdas).toHaveLength(1);
    expect(celdas[0]?.cantidad).toBe(3);
    // La celda está donde dice la ubicación pública, no la real (-16.6, -68.2).
    expect(celdas[0]?.latitud).toBeCloseTo(-16.4955, 2);
    expect(celdas[0]?.longitud).toBeCloseTo(-68.1336, 2);
  });
});
