import { crearDb, migrarTodo, migracionesDePlataforma } from '@gis/platform';
import type { Db } from '@gis/platform';
import { codigoCategoria, idReporte, idUsuario, PuntoGeo } from '@gis/shared-kernel';
import type { CajaGeografica } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration, desplazar } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RepositorioReportesPostgis } from '../adapters/report-repository.js';
import { CATEGORIAS_MVP } from '../domain/category.js';
import { Reporte } from '../domain/report.js';
import { reportsModulo } from '../index.js';

const autor = idUsuario('11111111-1111-4111-8111-111111111111');
const creado = new Date('2026-10-12T12:00:00.000Z');
const minutosDespues = (minutos: number) => new Date(creado.getTime() + minutos * 60_000);
const plazaMurillo = PuntoGeo.crear(-16.4955, -68.1336);

const categoria = (codigo: string) => CATEGORIAS_MVP.find((c) => c.codigo === codigo)!;

let secuencia = 0;
function nuevoReporte(codigo: string, ubicacion: PuntoGeo, ahora = creado): Reporte {
  secuencia += 1;
  const sufijo = String(secuencia).padStart(12, '0');
  return Reporte.crear({
    id: idReporte(`bbbbbbbb-bbbb-4bbb-8bbb-${sufijo}`),
    categoria: categoria(codigo),
    authorId: autor,
    location: ubicacion,
    idempotencyKey: `clave-espacial-${sufijo}`,
    ahora,
  });
}

describeIntegration('consultas espaciales de reports', () => {
  let base: TestDatabase;
  let db: Db;
  let reportes: RepositorioReportesPostgis;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [migracionesDePlataforma, reportsModulo.migraciones!]);
    reportes = new RepositorioReportesPostgis(db);
  });

  beforeEach(async () => {
    await db.execute(sql`delete from reportes`);
  });

  afterAll(async () => {
    await base?.close();
  });

  describe('buscarEnVentana', () => {
    const ventana: CajaGeografica = {
      latitudMin: -16.5,
      latitudMax: -16.49,
      longitudMin: -68.14,
      longitudMax: -68.13,
    };
    const vigentes = ['ACTIVO', 'CONFIRMADO'] as const;

    it('HU-02: incluye los puntos dentro y en el borde, y excluye los de fuera', async () => {
      const dentro = nuevoReporte('accidente', PuntoGeo.crear(-16.495, -68.135));
      const enElBorde = nuevoReporte('accidente', PuntoGeo.crear(-16.5, -68.14));
      const fuera = nuevoReporte('accidente', PuntoGeo.crear(-16.4899, -68.135));
      for (const reporte of [dentro, enElBorde, fuera]) await reportes.guardar(reporte);

      const encontrados = await reportes.buscarEnVentana(ventana, [], vigentes, 100);

      expect(encontrados.map((r) => r.id).sort()).toEqual([dentro.id, enElBorde.id].sort());
    });

    it('HU-02: filtra por categoría y por estado', async () => {
      const accidente = nuevoReporte('accidente', PuntoGeo.crear(-16.495, -68.135));
      const bloqueo = nuevoReporte('bloqueo', PuntoGeo.crear(-16.496, -68.135));
      const resuelto = nuevoReporte('accidente', PuntoGeo.crear(-16.497, -68.135));
      resuelto.marcarResuelto(minutosDespues(5));
      for (const reporte of [accidente, bloqueo, resuelto]) await reportes.guardar(reporte);

      const soloAccidentes = await reportes.buscarEnVentana(
        ventana,
        [codigoCategoria('accidente')],
        vigentes,
        100,
      );
      const resueltos = await reportes.buscarEnVentana(ventana, [], ['RESUELTO'], 100);

      expect(soloAccidentes.map((r) => r.id)).toEqual([accidente.id]);
      expect(resueltos.map((r) => r.id)).toEqual([resuelto.id]);
    });

    it('RNF-14: devuelve la ubicación pública y nunca la real ni el autor', async () => {
      const robo = nuevoReporte('robo', PuntoGeo.crear(-16.4951, -68.1351));
      await reportes.guardar(robo);

      const [encontrado] = await reportes.buscarEnVentana(ventana, [], vigentes, 100);

      expect(encontrado?.publicLocation).toEqual(robo.publicLocation);
      expect(encontrado?.publicLocation).not.toEqual(robo.location);
      expect(Object.keys(encontrado!)).not.toContain('location');
      expect(Object.keys(encontrado!)).not.toContain('authorId');
    });
    it('RNF-14: exige indicar los estados, para no publicar rechazados por descuido', async () => {
      await expect(reportes.buscarEnVentana(ventana, [], [], 100)).rejects.toThrow(RangeError);
    });

    it('HU-02: devuelve como máximo el límite, empezando por los más recientes', async () => {
      const antiguo = nuevoReporte('accidente', PuntoGeo.crear(-16.495, -68.135), creado);
      const medio = nuevoReporte('accidente', PuntoGeo.crear(-16.496, -68.135), minutosDespues(10));
      const reciente = nuevoReporte(
        'accidente',
        PuntoGeo.crear(-16.497, -68.135),
        minutosDespues(20),
      );
      for (const reporte of [medio, antiguo, reciente]) await reportes.guardar(reporte);

      const encontrados = await reportes.buscarEnVentana(ventana, [], vigentes, 2);

      expect(encontrados.map((r) => r.id)).toEqual([reciente.id, medio.id]);
    });

    it.each([0, -1, 1.5])('rechaza el límite %d', async (limite) => {
      await expect(reportes.buscarEnVentana(ventana, [], vigentes, limite)).rejects.toThrow(
        RangeError,
      );
    });
  });

  describe('buscarCercanos', () => {
    it('incluye los reportes dentro del radio y excluye los de fuera', async () => {
      const aNoventa = nuevoReporte('accidente', desplazar(plazaMurillo, 90, 0));
      const aCientoDiez = nuevoReporte('accidente', desplazar(plazaMurillo, 0, 110));
      const lejos = nuevoReporte('accidente', desplazar(plazaMurillo, 2000, 2000));
      for (const reporte of [aNoventa, aCientoDiez, lejos]) await reportes.guardar(reporte);

      const cercanos = await reportes.buscarCercanos(plazaMurillo, 100, 50);

      expect(cercanos.map((r) => r.id)).toEqual([aNoventa.id]);
    });

    it('ordena del más cercano al más lejano', async () => {
      const lejano = nuevoReporte('accidente', desplazar(plazaMurillo, 80, 0));
      const medio = nuevoReporte('accidente', desplazar(plazaMurillo, 40, 0));
      const cercano = nuevoReporte('accidente', desplazar(plazaMurillo, 10, 0));
      for (const reporte of [lejano, medio, cercano]) await reportes.guardar(reporte);

      const cercanos = await reportes.buscarCercanos(plazaMurillo, 100, 50);

      expect(cercanos.map((r) => r.id)).toEqual([cercano.id, medio.id, lejano.id]);
    });

    it('solo devuelve reportes vigentes', async () => {
      const vigente = nuevoReporte('accidente', desplazar(plazaMurillo, 20, 0));
      const resuelto = nuevoReporte('accidente', desplazar(plazaMurillo, 10, 0));
      resuelto.marcarResuelto(minutosDespues(5));
      for (const reporte of [vigente, resuelto]) await reportes.guardar(reporte);

      const cercanos = await reportes.buscarCercanos(plazaMurillo, 100, 50);

      expect(cercanos.map((r) => r.id)).toEqual([vigente.id]);
    });

    it('devuelve como máximo el límite, empezando por los más cercanos', async () => {
      const lejano = nuevoReporte('accidente', desplazar(plazaMurillo, 80, 0));
      const cercano = nuevoReporte('accidente', desplazar(plazaMurillo, 10, 0));
      for (const reporte of [lejano, cercano]) await reportes.guardar(reporte);

      const cercanos = await reportes.buscarCercanos(plazaMurillo, 100, 1);

      expect(cercanos.map((r) => r.id)).toEqual([cercano.id]);
    });

    it.each([0, -1, 1.5])('rechaza el límite %d', async (limite) => {
      await expect(reportes.buscarCercanos(plazaMurillo, 100, limite)).rejects.toThrow(RangeError);
    });

    it.each([0, -5, Number.NaN])('rechaza el radio %d', async (radio) => {
      await expect(reportes.buscarCercanos(plazaMurillo, radio, 50)).rejects.toThrow(RangeError);
    });
  });

  describe('buscarDuplicado', () => {
    it('HU-01: dos reportes del mismo tipo a 20 m son duplicados', async () => {
      const original = nuevoReporte('bloqueo', plazaMurillo);
      await reportes.guardar(original);

      const duplicado = await reportes.buscarDuplicado(
        categoria('bloqueo'),
        desplazar(plazaMurillo, 20, 0),
        minutosDespues(10),
      );

      expect(duplicado?.id).toBe(original.id);
    });

    it('HU-01: a más del radio de la categoría ya no es duplicado', async () => {
      // El radio de `bloqueo` es 100 m; `accidente` es 50 m.
      await reportes.guardar(nuevoReporte('bloqueo', plazaMurillo));
      await reportes.guardar(nuevoReporte('accidente', plazaMurillo));

      const aTrescientos = await reportes.buscarDuplicado(
        categoria('bloqueo'),
        desplazar(plazaMurillo, 300, 0),
        minutosDespues(10),
      );
      const aSetenta = await reportes.buscarDuplicado(
        categoria('accidente'),
        desplazar(plazaMurillo, 70, 0),
        minutosDespues(10),
      );

      const aSesenta = await reportes.buscarDuplicado(
        categoria('bloqueo'),
        desplazar(plazaMurillo, 60, 0),
        minutosDespues(10),
      );

      expect(aTrescientos).toBeNull();
      expect(aSetenta).toBeNull(); // accidente: radio de 50 m
      expect(aSesenta).not.toBeNull(); // bloqueo: radio de 100 m
    });

    it('HU-01: una categoría distinta no es duplicado aunque esté en el mismo punto', async () => {
      await reportes.guardar(nuevoReporte('bloqueo', plazaMurillo));

      const otraCategoria = await reportes.buscarDuplicado(
        categoria('accidente'),
        plazaMurillo,
        minutosDespues(10),
      );

      expect(otraCategoria).toBeNull();
    });

    it('HU-01: un reporte caducado o resuelto no cuenta como duplicado', async () => {
      const resuelto = nuevoReporte('bloqueo', plazaMurillo);
      resuelto.marcarResuelto(minutosDespues(5));
      await reportes.guardar(resuelto);
      await reportes.guardar(nuevoReporte('bloqueo', desplazar(plazaMurillo, 10, 0)));

      // `bloqueo` dura 360 minutos: a los 361 el segundo ya venció.
      const despuesDeCaducar = await reportes.buscarDuplicado(
        categoria('bloqueo'),
        plazaMurillo,
        minutosDespues(361),
      );

      expect(despuesDeCaducar).toBeNull();
    });

    it('si hay varios duplicados devuelve el más cercano', async () => {
      const lejano = nuevoReporte('bloqueo', desplazar(plazaMurillo, 80, 0));
      const cercano = nuevoReporte('bloqueo', desplazar(plazaMurillo, 15, 0));
      await reportes.guardar(lejano);
      await reportes.guardar(cercano);

      const duplicado = await reportes.buscarDuplicado(
        categoria('bloqueo'),
        plazaMurillo,
        minutosDespues(10),
      );

      expect(duplicado?.id).toBe(cercano.id);
    });
  });

  describe('buscarCaducados', () => {
    it('HU-04: devuelve los vigentes cuya caducidad ya pasó, del más antiguo al más reciente', async () => {
      const primero = nuevoReporte('accidente', plazaMurillo, creado); // caduca a los 180 min
      const segundo = nuevoReporte(
        'accidente',
        desplazar(plazaMurillo, 500, 0),
        minutosDespues(30),
      );
      const vigente = nuevoReporte('bloqueo', desplazar(plazaMurillo, 900, 0), creado); // 360 min
      for (const reporte of [segundo, vigente, primero]) await reportes.guardar(reporte);

      const caducados = await reportes.buscarCaducados(minutosDespues(300), 10);

      expect(caducados.map((r) => r.id)).toEqual([primero.id, segundo.id]);
    });

    it('HU-04: en el instante exacto de la caducidad el reporte sigue vigente', async () => {
      await reportes.guardar(nuevoReporte('accidente', plazaMurillo, creado));

      const alLimite = await reportes.buscarCaducados(minutosDespues(180), 10);
      const unMinutoDespues = await reportes.buscarCaducados(minutosDespues(181), 10);

      expect(alLimite).toEqual([]);
      expect(unMinutoDespues).toHaveLength(1);
    });

    it('ignora los reportes que ya salieron del ciclo vigente', async () => {
      const resuelto = nuevoReporte('accidente', plazaMurillo);
      resuelto.marcarResuelto(minutosDespues(5));
      const caducado = nuevoReporte('accidente', desplazar(plazaMurillo, 300, 0));
      caducado.caducar(minutosDespues(200));
      for (const reporte of [resuelto, caducado]) await reportes.guardar(reporte);

      expect(await reportes.buscarCaducados(minutosDespues(500), 10)).toEqual([]);
    });

    it('procesa en lotes: respeta el límite', async () => {
      for (let i = 0; i < 5; i += 1) {
        await reportes.guardar(nuevoReporte('accidente', desplazar(plazaMurillo, i * 300, 0)));
      }

      const lote = await reportes.buscarCaducados(minutosDespues(500), 2);

      expect(lote).toHaveLength(2);
    });

    it.each([0, -1, 1.5])('rechaza el límite %d', async (limite) => {
      await expect(reportes.buscarCaducados(creado, limite)).rejects.toThrow(RangeError);
    });
  });
});
