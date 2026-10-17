import type { EventoDeIntegracion } from '@gis/contracts';
import { claveDeEvento } from '@gis/contracts';
import { identityModulo } from '@gis/module-identity';
import {
  moderationModulo,
  RechazarReporte,
  UnidadDeTrabajoModeracionPg,
} from '@gis/module-moderation';
import {
  AplicarDecisionDeVerificacion,
  AplicarRechazoDeModeracion,
  CrearReporte,
  RepositorioCategoriasPg,
  RepositorioReportesPostgis,
  reportsModulo,
  UnidadDeTrabajoReportePg,
} from '@gis/module-reports';
import {
  NotificarSuscriptores,
  RepositorioSuscripcionesPg,
  SuscribirZona,
  subscriptionsModulo,
} from '@gis/module-subscriptions';
import type { AvisoDeReporte } from '@gis/module-subscriptions';
import {
  AjustarReputacionPorDesenlace,
  ConfirmarReporte,
  RegistrarConfirmacionPorDuplicado,
  RepositorioReputacionesPg,
  RepositorioVotosPg,
  UnidadDeTrabajoVotoPg,
  verificationModulo,
} from '@gis/module-verification';
import { crearDb, eventosSalida, migracionesDePlataforma, migrarTodo } from '@gis/platform';
import type { Db } from '@gis/platform';
import { idReporte, idUsuario, PuntoGeo } from '@gis/shared-kernel';
import type { PuntoGeo as Punto } from '@gis/shared-kernel';
import {
  createTestDatabase,
  describeIntegration,
  desplazar,
  GeneradorDeIdSecuencial,
  LimitadorEnMemoria,
  RelojFijo,
} from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { asc } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  consultaDeAutor,
  consultaParaModeracion,
  consultaParaVerificacion,
  reputacionDelAutor,
} from './composicion/puentes.js';

const usuario = (n: number) => idUsuario(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const ANA = usuario(1);
const BETO = usuario(2);
const CARLA = usuario(3);
const DARIO = usuario(4);
const EVA = usuario(5);
const MODERADORA = usuario(6);

/**
 * Fase 5: los casos de uso de varios módulos, con sus adaptadores PostGIS reales, encadenados por
 * los eventos del outbox. Un despachador mínimo reparte los eventos a sus manejadores, como hará
 * el de la Fase 7.
 */
describeIntegration('casos de uso encadenados por eventos', () => {
  let base: TestDatabase;
  let db: Db;
  const reloj = new RelojFijo();
  const ids = new GeneradorDeIdSecuencial('cccccccc');
  const avisos: AvisoDeReporte[] = [];
  let casos: ReturnType<typeof componer>;

  function componer(db: Db) {
    const reportes = new RepositorioReportesPostgis(db);
    const votos = new RepositorioVotosPg(db);
    const reputaciones = new RepositorioReputacionesPg(db);
    const suscripciones = new RepositorioSuscripcionesPg(db);
    const limitador = new LimitadorEnMemoria(reloj);
    const transicion = { reportes, unidadDeTrabajo: new UnidadDeTrabajoReportePg(db), reloj, ids };
    const voto = {
      consultaDeReporte: consultaParaVerificacion(reportes),
      votos,
      reputaciones,
      unidadDeTrabajo: new UnidadDeTrabajoVotoPg(db),
      reloj,
      ids,
    };
    const manejadores: Record<string, (evento: EventoDeIntegracion) => Promise<unknown>> = {};
    const escuchar = (
      claves: readonly string[],
      manejar: (e: EventoDeIntegracion) => Promise<unknown>,
    ) => {
      for (const clave of claves) manejadores[clave] = manejar;
    };
    const notificar = new NotificarSuscriptores({
      suscripciones,
      consultaDeAutor: consultaDeAutor(reportes),
      enviador: { enviar: async (aviso) => void avisos.push(aviso) },
    });
    const duplicado = new RegistrarConfirmacionPorDuplicado(voto);
    const decision = new AplicarDecisionDeVerificacion(transicion);
    const rechazo = new AplicarRechazoDeModeracion(transicion);
    const reputacion = new AjustarReputacionPorDesenlace(voto);
    escuchar(['ReporteCreado.v1'], (e) => notificar.manejar(e));
    escuchar(['ReporteDuplicadoDetectado.v1'], (e) => duplicado.manejar(e));
    escuchar(['VotoEmitido.v1'], (e) => decision.manejar(e));
    escuchar(['RechazoDeModeracion.v1'], (e) => rechazo.manejar(e));
    escuchar(AjustarReputacionPorDesenlace.eventos, (e) => reputacion.manejar(e));

    return {
      reportes,
      votos,
      reputaciones,
      manejadores,
      crear: new CrearReporte({
        reportes,
        categorias: new RepositorioCategoriasPg(db),
        unidadDeTrabajo: transicion.unidadDeTrabajo,
        reputacion: reputacionDelAutor(reputaciones),
        limitador,
        reloj,
        ids,
      }),
      confirmar: new ConfirmarReporte({ ...voto, limitador }),
      suscribir: new SuscribirZona({ suscripciones, reloj, ids }),
      rechazar: new RechazarReporte({
        consultaDeReporte: consultaParaModeracion(reportes),
        unidadDeTrabajo: new UnidadDeTrabajoModeracionPg(db),
        reloj,
        ids,
      }),
    };
  }

  const despachados = new Set<string>();
  /** Entrega cada evento del outbox una vez, en orden, hasta que no aparezcan nuevos. */
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
        await casos.manejadores[claveDeEvento(evento)]?.(evento);
      }
    }
  }

  const crear = (autor: string, codigo: string, punto: Punto, clave: string) =>
    casos.crear.ejecutar({
      idAutor: autor,
      codigoCategoria: codigo,
      latitud: punto.latitud,
      longitud: punto.longitud,
      idempotencyKey: clave,
    });
  const confirmar = (id: string, votante: string, punto: Punto) =>
    casos.confirmar.ejecutar({
      idReporte: id,
      idVotante: votante,
      latitud: punto.latitud,
      longitud: punto.longitud,
    });
  const puntaje = async (id: string) =>
    (await casos.reputaciones.buscarPorUsuario(idUsuario(id)))?.puntaje;

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [
      migracionesDePlataforma,
      ...[
        identityModulo,
        reportsModulo,
        verificationModulo,
        subscriptionsModulo,
        moderationModulo,
      ].map((modulo) => modulo.migraciones!),
    ]);
    casos = componer(db);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('HU-01: dos bloqueos a 20 m dejan un solo reporte con una confirmación', async () => {
    const plaza = PuntoGeo.crear(-16.4955, -68.1336);
    const original = await crear(ANA, 'bloqueo', plaza, 'dedup-ana-0001');

    const duplicado = await crear(BETO, 'bloqueo', desplazar(plaza, 20, 0), 'dedup-beto-0001');
    await despachar();

    expect(duplicado).toMatchObject({
      resultado: 'DUPLICADO',
      reporte: { id: original.reporte.id },
    });
    const votos = await casos.votos.buscarPorReporte(idReporte(original.reporte.id));
    expect(votos).toMatchObject([{ idVotante: BETO, valor: 'CONFIRMACION', peso: 1 }]);
  });

  it('HU-03 y HU-08: tres confirmaciones confirman el reporte, ajustan la reputación y se avisa una sola vez', async () => {
    const esquina = PuntoGeo.crear(-16.52, -68.1);
    await casos.suscribir.ejecutar({
      idUsuario: EVA,
      latitud: esquina.latitud,
      longitud: esquina.longitud,
      radioM: 800,
      categorias: ['accidente'],
    });
    const { reporte } = await crear(ANA, 'accidente', esquina, 'cadena-ana-0001');
    await crear(BETO, 'accidente', desplazar(esquina, 20, 0), 'cadena-beto-0001');
    await confirmar(reporte.id, CARLA, desplazar(esquina, 0, 300));
    await despachar();
    expect((await casos.reportes.buscarPorId(idReporte(reporte.id)))?.estado).toBe('ACTIVO');

    await confirmar(reporte.id, DARIO, desplazar(esquina, 300, 0));
    const entregados = await despachar();

    expect(entregados).toEqual(['VotoEmitido.v1', 'ReporteConfirmado.v1']);
    const confirmado = await casos.reportes.buscarPorId(idReporte(reporte.id));
    expect(confirmado?.estado).toBe('CONFIRMADO');
    expect(confirmado!.caducaEn.getTime() - reporte.caducaEn.getTime()).toBe(90 * 60_000);
    // Ana ganó 0,20 por este reporte; Beto, Carla y Darío, 0,05 por confirmar.
    expect(await puntaje(ANA)).toBe(1.2);
    expect([await puntaje(BETO), await puntaje(CARLA), await puntaje(DARIO)]).toEqual([
      1.05, 1.05, 1.05,
    ]);
    expect(avisos.filter((a) => a.idReporte === reporte.id).map((a) => a.idUsuario)).toEqual([EVA]);
  });

  it('HU-12: el rechazo de un moderador retira el reporte y resta 0,50 al autor', async () => {
    const lugar = PuntoGeo.crear(-16.45, -68.2);
    const { reporte } = await crear(CARLA, 'jauria', lugar, 'moderar-carla-01');
    const antes = (await puntaje(CARLA)) ?? 1;

    await casos.rechazar.ejecutar({
      idReporte: reporte.id,
      idModerador: MODERADORA,
      rolActor: 'MODERADOR',
      motivo: 'Reporte falso',
    });
    const entregados = await despachar();

    expect(entregados).toEqual([
      'ReporteCreado.v1',
      'RechazoDeModeracion.v1',
      'ReporteRechazado.v1',
    ]);
    expect(await casos.reportes.buscarPorId(idReporte(reporte.id))).toMatchObject({
      estado: 'RECHAZADO',
      motivoRechazo: 'MODERACION',
    });
    expect(await puntaje(CARLA)).toBe(Math.round((antes - 0.5) * 100) / 100);
  });
});
