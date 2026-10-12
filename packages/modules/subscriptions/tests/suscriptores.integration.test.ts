import { crearDb, migrarTodo, migracionesDePlataforma } from '@gis/platform';
import type { Db } from '@gis/platform';
import { createTestDatabase, describeIntegration, desplazar } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { RepositorioSuscripcionesPg } from '../adapters/subscription-repository.js';
import { subscriptionsModulo } from '../index.js';
import { ahora, ana, beto, bloqueo, idZona, plazaMurillo, robo, zona } from './fixtures.js';

const minutosDespues = (minutos: number) => new Date(ahora.getTime() + minutos * 60_000);

describeIntegration('buscarSuscriptores', () => {
  let base: TestDatabase;
  let db: Db;
  let zonas: RepositorioSuscripcionesPg;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, subscriptionsModulo.migraciones!]);
    zonas = new RepositorioSuscripcionesPg(db);
  });

  beforeEach(async () => {
    await db.execute(sql`delete from zonas_suscritas`);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-08: encuentra las zonas cuyo círculo contiene el punto', async () => {
    await zonas.guardar(zona({ id: idZona(1), radioM: 800 }));

    const aSetecientos = await zonas.buscarSuscriptores(desplazar(plazaMurillo, 700, 0), bloqueo);
    const aNovecientos = await zonas.buscarSuscriptores(desplazar(plazaMurillo, 0, 900), bloqueo);

    expect(aSetecientos.map((z) => z.id)).toEqual([idZona(1)]);
    expect(aNovecientos).toEqual([]);
  });

  it('HU-08: el centro de la zona está siempre dentro', async () => {
    await zonas.guardar(zona({ id: idZona(1), radioM: 100 }));

    expect(await zonas.buscarSuscriptores(plazaMurillo, bloqueo)).toHaveLength(1);
  });

  it('HU-08: solo cuentan las zonas que eligieron la categoría del reporte', async () => {
    await zonas.guardar(zona({ id: idZona(1), categorias: [bloqueo] }));
    await zonas.guardar(zona({ id: idZona(2), idUsuario: beto, categorias: [robo] }));

    const porBloqueo = await zonas.buscarSuscriptores(plazaMurillo, bloqueo);
    const porRobo = await zonas.buscarSuscriptores(plazaMurillo, robo);

    expect(porBloqueo.map((z) => z.idUsuario)).toEqual([ana]);
    expect(porRobo.map((z) => z.idUsuario)).toEqual([beto]);
  });

  it('HU-08: cada zona usa su propio radio', async () => {
    await zonas.guardar(zona({ id: idZona(1), radioM: 100 }));
    await zonas.guardar(zona({ id: idZona(2), idUsuario: beto, radioM: 2000 }));

    const aQuinientos = await zonas.buscarSuscriptores(desplazar(plazaMurillo, 500, 0), bloqueo);

    expect(aQuinientos.map((z) => z.id)).toEqual([idZona(2)]);
  });

  it('devuelve las zonas en el orden en que se crearon', async () => {
    await zonas.guardar(zona({ id: idZona(2), idUsuario: beto, ahora: minutosDespues(10) }));
    await zonas.guardar(zona({ id: idZona(1), ahora: minutosDespues(1) }));

    const encontradas = await zonas.buscarSuscriptores(plazaMurillo, bloqueo);

    expect(encontradas.map((z) => z.id)).toEqual([idZona(1), idZona(2)]);
  });

  it('un usuario con varias zonas que contienen el punto aparece en cada una', async () => {
    await zonas.guardar(zona({ id: idZona(1), radioM: 300 }));
    await zonas.guardar(zona({ id: idZona(2), radioM: 900 }));

    const encontradas = await zonas.buscarSuscriptores(plazaMurillo, bloqueo);

    expect(encontradas).toHaveLength(2);
  });
});
