import { crearDb, migrarTodo, migracionesDePlataforma } from '@gis/platform';
import type { Db } from '@gis/platform';
import { idReporte, idUsuario } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RepositorioColaPg } from '../adapters/repositorio-cola-pg.js';
import { UnidadDeTrabajoModeracionPg } from '../adapters/unidad-de-trabajo-moderacion.js';
import { AccionDeModeracion } from '../domain/accion-de-moderacion.js';
import type { IdAccionDeModeracion } from '../domain/accion-de-moderacion.js';
import { CasoDeModeracion } from '../domain/caso-de-moderacion.js';
import { moderationModulo } from '../index.js';

const reporte = (n: number) => idReporte(`6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`);
const base = new Date('2026-10-19T12:00:00.000Z');
const minuto = (n: number) => new Date(base.getTime() + n * 60_000);

describeIntegration('cola de moderación en PostGIS', () => {
  let contenedor: TestDatabase;
  let db: Db;
  let cola: RepositorioColaPg;

  beforeAll(async () => {
    contenedor = await createTestDatabase();
    db = crearDb(contenedor.pool);
    await migrarTodo(db, [migracionesDePlataforma, moderationModulo.migraciones!]);
    cola = new RepositorioColaPg(db);
  });

  afterAll(async () => {
    await contenedor?.close();
  });

  it('HU-10 y HU-12: guarda los casos y lista los pendientes en orden de revisión', async () => {
    const negado = CasoDeModeracion.abrir(reporte(1), base);
    negado.registrarNegacion(minuto(1));
    const masNegado = CasoDeModeracion.abrir(reporte(2), base);
    masNegado.registrarNegacion(minuto(2));
    masNegado.registrarNegacion(minuto(3));
    const marcado = CasoDeModeracion.abrir(reporte(3), base);
    marcado.marcar(['ENLACE', 'SPAM'], minuto(4));
    const resuelto = CasoDeModeracion.abrir(reporte(4), base);
    resuelto.registrarNegacion(minuto(1));
    resuelto.resolver(minuto(5));
    for (const caso of [negado, masNegado, marcado, resuelto]) await cola.guardar(caso);

    const pendientes = await cola.listarPendientes(10);

    expect(pendientes.map((c) => c.idReporte)).toEqual([reporte(3), reporte(2), reporte(1)]);
    expect(await cola.buscar(reporte(3))).toMatchObject({
      marcado: true,
      motivos: ['ENLACE', 'SPAM'],
      actualizadoEn: minuto(4),
      resueltoEn: null,
    });
    expect(await cola.listarPendientes(1)).toHaveLength(1);
    expect(await cola.buscar(reporte(99))).toBeNull();
  });

  it('HU-12: la decisión de un moderador saca el reporte de la cola en la misma transacción', async () => {
    const caso = CasoDeModeracion.abrir(reporte(10), base);
    caso.registrarNegacion(minuto(1));
    await cola.guardar(caso);

    await new UnidadDeTrabajoModeracionPg(db).registrar(
      AccionDeModeracion.mantener({
        id: '00000000-0000-4000-8000-000000000010' as IdAccionDeModeracion,
        idReporte: reporte(10),
        idModerador: idUsuario('11111111-1111-4111-8111-111111111111'),
        ahora: minuto(20),
      }),
      [],
    );

    expect(await cola.buscar(reporte(10))).toMatchObject({ resueltoEn: minuto(20) });
  });
});
