import type { EventoDeIntegracion } from '@gis/contracts';
import { claveDeEvento } from '@gis/contracts';
import {
  ClasificadorConRespaldo,
  ClasificadorPorReglas,
  ClasificarReporte,
  classifierModulo,
  UnidadDeTrabajoClasificacionPg,
} from '@gis/module-classifier';
import type { Clasificador } from '@gis/module-classifier';
import {
  ActualizarColaDeModeracion,
  ListarColaDeModeracion,
  moderationModulo,
  RechazarReporte,
  RepositorioColaPg,
  UnidadDeTrabajoModeracionPg,
} from '@gis/module-moderation';
import {
  openDataModulo,
  RegistrarDatoAbierto,
  RepositorioDatosAbiertosPg,
} from '@gis/module-open-data';
import {
  AgregarDescripcion,
  AplicarRechazoDeModeracion,
  CrearReporte,
  RepositorioCategoriasPg,
  RepositorioReportesPostgis,
  reportsModulo,
  UnidadDeTrabajoReportePg,
} from '@gis/module-reports';
import { crearDb, eventosSalida, migracionesDePlataforma, migrarTodo } from '@gis/platform';
import type { Db } from '@gis/platform';
import { idReporte, PuntoGeo } from '@gis/shared-kernel';
import {
  createTestDatabase,
  describeIntegration,
  desplazar,
  GeneradorDeIdSecuencial,
  LimitadorEnMemoria,
  RelojFijo,
} from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { asc, sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  consultaDeReportesFinalizados,
  consultaParaClasificar,
  consultaParaModeracion,
} from './composicion/puentes.js';

const usuario = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const centro = PuntoGeo.crear(-16.5, -68.13);

/** Un modelo de IA caído: siempre falla. */
const modeloCaido: Clasificador = {
  clasificar: () => Promise.reject(new Error('ECONNREFUSED')),
};

/**
 * HU-10 y HU-12 de extremo a extremo con PostGIS: el reporte se crea sin esperar al clasificador,
 * que lo revisa al procesar el outbox, y lo marcado llega a la cola de moderación. El clasificador
 * principal está caído, así que deciden las reglas.
 */
describeIntegration('clasificación y moderación encadenadas por eventos', () => {
  let base: TestDatabase;
  let db: Db;
  const reloj = new RelojFijo();
  const ids = new GeneradorDeIdSecuencial('dddddddd');
  let crear: CrearReporte;
  let describir: AgregarDescripcion;
  let rechazar: RechazarReporte;
  let listarCola: ListarColaDeModeracion;
  let reportes: RepositorioReportesPostgis;
  const manejadores = new Map<string, ((e: EventoDeIntegracion) => Promise<unknown>)[]>();
  const fallos: unknown[] = [];

  const escuchar = (
    claves: readonly string[],
    manejar: (e: EventoDeIntegracion) => Promise<unknown>,
  ) => {
    for (const clave of claves)
      manejadores.set(clave, [...(manejadores.get(clave) ?? []), manejar]);
  };

  const despachados = new Set<string>();
  /** Entrega cada evento nuevo del outbox a sus manejadores, hasta que no aparezcan más. */
  async function despachar(): Promise<string[]> {
    const entregados: string[] = [];
    for (;;) {
      const filas = await db.select().from(eventosSalida).orderBy(asc(eventosSalida.creadoEn));
      const pendientes = filas.filter((fila) => !despachados.has(fila.id));
      if (pendientes.length === 0) return entregados;
      for (const fila of pendientes) {
        despachados.add(fila.id);
        const evento = fila.contenido as EventoDeIntegracion;
        entregados.push(claveDeEvento(evento));
        for (const manejar of manejadores.get(claveDeEvento(evento)) ?? []) await manejar(evento);
      }
    }
  }

  const clasificaciones = async (idReporte: string) => {
    const { rows } = await db.execute(
      sql`select sospechoso, motivos, clasificador from clasificaciones
          where id_reporte = ${idReporte} order by creado_en, id`,
    );
    return rows;
  };

  let n = 0;
  const nuevo = (autor: string, punto = centro) =>
    crear.ejecutar({
      idAutor: autor,
      codigoCategoria: 'infraestructura',
      latitud: punto.latitud,
      longitud: punto.longitud,
      idempotencyKey: `clasificar-${String((n += 1)).padStart(4, '0')}`,
    });

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [
      migracionesDePlataforma,
      reportsModulo.migraciones!,
      classifierModulo.migraciones!,
      moderationModulo.migraciones!,
      openDataModulo.migraciones!,
    ]);
    reportes = new RepositorioReportesPostgis(db);
    const unidadDeTrabajo = new UnidadDeTrabajoReportePg(db);
    crear = new CrearReporte({
      reportes,
      categorias: new RepositorioCategoriasPg(db),
      unidadDeTrabajo,
      reputacion: { estaSilenciado: () => Promise.resolve(false) },
      limitador: new LimitadorEnMemoria(reloj),
      reloj,
      ids,
    });
    describir = new AgregarDescripcion({ reportes, unidadDeTrabajo, reloj, ids });
    const clasificar = new ClasificarReporte({
      consulta: consultaParaClasificar(reportes),
      clasificador: new ClasificadorConRespaldo(modeloCaido, new ClasificadorPorReglas(), {
        tiempoLimiteMs: 1000,
        alFallar: (error) => fallos.push(error),
      }),
      unidadDeTrabajo: new UnidadDeTrabajoClasificacionPg(db),
      reloj,
      ids,
    });
    const cola = new RepositorioColaPg(db);
    const actualizarCola = new ActualizarColaDeModeracion(cola);
    const aplicarRechazo = new AplicarRechazoDeModeracion({
      reportes,
      unidadDeTrabajo,
      reloj,
      ids,
    });
    escuchar(ClasificarReporte.eventos, (e) => clasificar.manejar(e));
    escuchar(ActualizarColaDeModeracion.eventos, (e) => actualizarCola.manejar(e));
    escuchar(['RechazoDeModeracion.v1'], (e) => aplicarRechazo.manejar(e));
    const datosAbiertos = new RegistrarDatoAbierto(
      consultaDeReportesFinalizados(reportes),
      new RepositorioDatosAbiertosPg(db),
    );
    escuchar(RegistrarDatoAbierto.eventos, (e) => datosAbiertos.manejar(e));
    const consultaDeReporte = consultaParaModeracion(reportes);
    rechazar = new RechazarReporte({
      consultaDeReporte,
      unidadDeTrabajo: new UnidadDeTrabajoModeracionPg(db),
      reloj,
      ids,
    });
    listarCola = new ListarColaDeModeracion(cola, consultaDeReporte);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-10: crear un reporte no depende del clasificador y se clasifica con las reglas locales', async () => {
    const { resultado, reporte } = await nuevo(usuario(1));

    expect(resultado).toBe('CREADO');
    expect(await clasificaciones(reporte.id)).toEqual([]);

    const entregados = await despachar();

    expect(entregados).toEqual(['ReporteCreado.v2', 'ReporteClasificado.v1']);
    expect(await clasificaciones(reporte.id)).toEqual([
      { sospechoso: false, motivos: [], clasificador: 'reglas-v1' },
    ]);
    expect(fallos).toHaveLength(1);
  });

  it('HU-10: marca un reporte con indicios de spam cuando el autor lo describe', async () => {
    const { reporte } = await nuevo(usuario(2), desplazar(centro, 2000, 0));
    await despachar();

    await describir.ejecutar({
      idReporte: reporte.id,
      idAutor: usuario(2),
      descripcion: 'Promoción GRATIS en https://spam.example',
    });
    const entregados = await despachar();

    expect(entregados).toEqual(['DescripcionAgregada.v1', 'ReporteClasificado.v1']);
    expect((await clasificaciones(reporte.id)).at(-1)).toEqual({
      sospechoso: true,
      motivos: ['ENLACE', 'SPAM'],
      clasificador: 'reglas-v1',
    });
  });

  it('HU-10: marca al autor que reporta en ráfaga', async () => {
    const autor = usuario(3);
    const creados = [];
    for (let i = 0; i < 4; i += 1) {
      reloj.avanzarMinutos(1);
      creados.push(await nuevo(autor, desplazar(centro, 0, 3000 + i * 1000)));
    }
    await despachar();

    expect((await clasificaciones(creados[3]!.reporte.id))[0]).toEqual({
      sospechoso: true,
      motivos: ['FRECUENCIA_DEL_AUTOR'],
      clasificador: 'reglas-v1',
    });
    expect((await clasificaciones(creados[2]!.reporte.id))[0]).toMatchObject({ sospechoso: false });
  });

  it('HU-10 y HU-12: un reporte con enlace aparece marcado en la cola y el moderador lo rechaza', async () => {
    const { reporte } = await nuevo(usuario(4), desplazar(centro, -3000, 0));
    await describir.ejecutar({
      idReporte: reporte.id,
      idAutor: usuario(4),
      descripcion: 'Info en https://estafa.example',
    });
    await despachar();

    const cola = await listarCola.ejecutar({ rolActor: 'MODERADOR' });
    expect(cola).toContainEqual(
      expect.objectContaining({
        idReporte: reporte.id,
        marcado: true,
        motivos: ['ENLACE'],
        descripcion: 'Info en https://estafa.example',
      }),
    );

    await rechazar.ejecutar({
      idReporte: reporte.id,
      idModerador: usuario(9),
      rolActor: 'MODERADOR',
      motivo: 'Publicidad engañosa',
    });
    const entregados = await despachar();

    expect(entregados).toEqual(['RechazoDeModeracion.v1', 'ReporteRechazado.v1']);
    expect((await reportes.buscarPorId(idReporte(reporte.id)))?.estado).toBe('RECHAZADO');
    const { rows } = await db.execute(
      sql`select accion, motivo from acciones_moderacion where id_reporte = ${reporte.id}`,
    );
    expect(rows).toEqual([{ accion: 'RECHAZAR', motivo: 'Publicidad engañosa' }]);
    // HU-11: el reporte terminado pasa anonimizado a los datos abiertos.
    const { rows: abiertos } = await db.execute(
      sql`select codigo_categoria, estado_final from datos_abiertos_reportes`,
    );
    expect(abiertos).toEqual([{ codigo_categoria: 'infraestructura', estado_final: 'RECHAZADO' }]);
    expect(
      (await listarCola.ejecutar({ rolActor: 'MODERADOR' })).map((c) => c.idReporte),
    ).not.toContain(reporte.id);
  });
});
