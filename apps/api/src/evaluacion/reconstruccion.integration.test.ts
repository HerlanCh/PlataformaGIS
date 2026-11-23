import { ConsultarVistas, evaluationModulo, RepositorioEvaluacionPg } from '@gis/module-evaluation';
import { identityModulo } from '@gis/module-identity';
import { moderationModulo } from '@gis/module-moderation';
import {
  CaducarReportes,
  RepositorioReportesPostgis,
  reportsModulo,
  UnidadDeTrabajoReportePg,
} from '@gis/module-reports';
import type { ReportePublico } from '@gis/module-reports';
import { verificationModulo } from '@gis/module-verification';
import {
  BusDeEventosConSalida,
  cargarInterruptores,
  crearDb,
  crearRegistro,
  DespachadorDeSalida,
  migracionesDePlataforma,
  migrarTodo,
} from '@gis/platform';
import type { Db } from '@gis/platform';
import { PuntoGeo } from '@gis/shared-kernel';
import {
  createTestDatabase,
  describeIntegration,
  desplazar,
  GeneradorDeIdSecuencial,
  LimitadorEnMemoria,
  RelojFijo,
} from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { componerCasosDeUso } from '../composicion/casos-de-uso.js';
import type { CasosDeUso } from '../composicion/casos-de-uso.js';
import { suscribirManejadores } from '../composicion/manejadores.js';

const usuario = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const plaza = PuntoGeo.crear(-16.5, -68.15);
const caja = { latitudMin: -16.52, latitudMax: -16.48, longitudMin: -68.17, longitudMax: -68.13 };

interface Fotografia {
  readonly instante: Date;
  readonly mapa: readonly ReportePublico[];
}

/** Lo que importa comparar de un punto del mapa: qué reporte, dónde, en qué estado y hasta cuándo. */
const comparable = (p: {
  idReporte: string;
  codigoCategoria: string;
  estado: string;
  caducaEn: Date;
  latitud: number;
  longitud: number;
  fuenteOficial: string | null;
}) => ({ ...p, caducaEn: p.caducaEn.toISOString() });

/**
 * HU-14, ADR-007: el flujo real (casos de uso, outbox, despachador y los manejadores de producción)
 * sobre PostGIS. En varios instantes se fotografía lo que devuelve la consulta del mapa; al final,
 * la vista procesada reconstruida desde el registro de la evaluación debe coincidir con cada foto.
 */
describeIntegration('reconstrucción de la vista procesada', () => {
  let base: TestDatabase;
  let db: Db;
  let casos: CasosDeUso;
  let despachador: DespachadorDeSalida;
  let caducar: CaducarReportes;
  const reloj = new RelojFijo('2026-11-22T12:00:00.000Z');
  const ids = new GeneradorDeIdSecuencial('dddddddd');
  const fotos: Fotografia[] = [];

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [
      migracionesDePlataforma,
      ...[
        identityModulo,
        reportsModulo,
        verificationModulo,
        moderationModulo,
        evaluationModulo,
      ].map((m) => m.migraciones!),
    ]);
    const interruptores = cargarInterruptores({
      FEATURE_EVALUATION: 'true',
      FEATURE_MODERATION: 'true',
    });
    const registro = crearRegistro('silent');
    const bus = new BusDeEventosConSalida(db);
    casos = componerCasosDeUso({
      db,
      interruptores,
      limitador: new LimitadorEnMemoria(reloj),
      reloj,
      ids,
    });
    suscribirManejadores({
      bus,
      db,
      interruptores,
      registro,
      tiempoReal: { difundir: () => undefined },
      reloj,
      ids,
    });
    despachador = new DespachadorDeSalida(db, bus, { registro });
    caducar = new CaducarReportes({
      reportes: new RepositorioReportesPostgis(db),
      unidadDeTrabajo: new UnidadDeTrabajoReportePg(db),
      reloj,
      ids,
    });
  });

  afterAll(async () => {
    await base?.close();
  });

  /** Entrega el outbox hasta vaciarlo, como el despachador en producción. */
  async function despachar(): Promise<void> {
    while ((await despachador.despacharPendientes()) > 0);
  }

  async function fotografiar(): Promise<void> {
    await despachar();
    const mapa = await casos.listarReportes.ejecutar({ ...caja, categorias: [] });
    fotos.push({ instante: reloj.ahora(), mapa });
  }

  let clave = 0;
  const crear = async (autor: number, codigoCategoria: string, punto: PuntoGeo) =>
    (
      await casos.crearReporte.ejecutar({
        idAutor: usuario(autor),
        codigoCategoria,
        latitud: punto.latitud,
        longitud: punto.longitud,
        idempotencyKey: `reconstruccion-${String((clave += 1)).padStart(4, '0')}`,
      })
    ).reporte.id;
  const votar = (
    sentido: 'confirmar' | 'negar',
    idReporte: string,
    votante: number,
    punto: PuntoGeo,
  ) =>
    (sentido === 'confirmar' ? casos.confirmarReporte : casos.negarReporte).ejecutar({
      idReporte,
      idVotante: usuario(votante),
      latitud: punto.latitud,
      longitud: punto.longitud,
    });

  it('HU-14: en cada instante la vista procesada coincide con lo que devolvía la consulta del mapa', async () => {
    const moderacion = casos.moderacion!;
    const bloqueo = await crear(1, 'bloqueo', plaza);
    await fotografiar();

    reloj.avanzarMinutos(5);
    await crear(2, 'bloqueo', desplazar(plaza, 20, 0)); // duplicado: confirma el bloqueo
    const robo = await crear(3, 'robo', desplazar(plaza, 0, 600)); // ubicación pública ofuscada
    await fotografiar();

    reloj.avanzarMinutos(5);
    await votar('confirmar', bloqueo, 4, desplazar(plaza, 300, 0));
    await votar('confirmar', bloqueo, 5, desplazar(plaza, 0, 300));
    await fotografiar(); // el bloqueo pasa a CONFIRMADO con más vigencia

    reloj.avanzarMinutos(5);
    const accidente = await crear(6, 'accidente', desplazar(plaza, -800, 0));
    const jauria = await crear(7, 'jauria', desplazar(plaza, 0, -900));
    await moderacion.publicarOficial.ejecutar({
      idModerador: usuario(99),
      rolActor: 'MODERADOR',
      codigoCategoria: 'infraestructura',
      latitud: plaza.latitud + 0.01,
      longitud: plaza.longitud,
      fuenteOficial: 'TRANSITO',
      idempotencyKey: 'reconstruccion-oficial-1',
    });
    await fotografiar();

    reloj.avanzarMinutos(5);
    await moderacion.rechazar.ejecutar({
      idReporte: jauria,
      idModerador: usuario(99),
      rolActor: 'MODERADOR',
      motivo: 'Prueba de reconstrucción',
    });
    for (const votante of [8, 9, 10]) {
      await votar('negar', accidente, votante, desplazar(plaza, -800, 200));
    }
    await fotografiar(); // la jauría rechazada y el accidente resuelto salen del mapa

    reloj.avanzarMinutos(110);
    await fotografiar(); // el robo (120 min) venció, pero aún no pasó la tarea de caducidad
    await caducar.ejecutar();
    await fotografiar();

    reloj.avanzarMinutos(600);
    await caducar.ejecutar();
    await fotografiar(); // también caducó el bloqueo confirmado

    const vistas = new ConsultarVistas(new RepositorioEvaluacionPg(db), reloj);
    const vistos = new Set<string>();
    for (const { instante, mapa } of fotos) {
      const reconstruida = await vistas.ejecutar({ rolActor: 'MODERADOR', instante, caja });
      const esperado = mapa
        .map((r) =>
          comparable({
            idReporte: r.id,
            codigoCategoria: r.codigoCategoria,
            estado: r.estado,
            caducaEn: r.caducaEn,
            latitud: r.publicLocation.latitud,
            longitud: r.publicLocation.longitud,
            fuenteOficial: r.fuenteOficial,
          }),
        )
        .toSorted((a, b) => a.idReporte.localeCompare(b.idReporte));
      const obtenido = reconstruida.procesada.map(({ publicLocation, ...p }) =>
        comparable({ ...p, ...publicLocation }),
      );

      expect(obtenido, `instante ${instante.toISOString()}`).toEqual(esperado);
      for (const p of esperado) vistos.add(`${p.idReporte}:${p.estado}`);
    }
    // El escenario recorrió los casos que importan.
    expect(vistos).toContain(`${bloqueo}:CONFIRMADO`);
    expect(vistos).toContain(`${robo}:ACTIVO`);
    expect(fotos.at(-1)!.mapa.map((r) => r.fuenteOficial)).toEqual(['TRANSITO']);
  });

  it('HU-14: el duplicado es un punto propio en la vista base y el rechazo lo quita de ambas vistas', async () => {
    const vistas = new ConsultarVistas(new RepositorioEvaluacionPg(db), reloj);
    const [, segunda, , , rechazo] = fotos;

    const conDuplicado = await vistas.ejecutar({
      rolActor: 'MODERADOR',
      instante: segunda!.instante,
      caja,
    });
    const trasRechazo = await vistas.ejecutar({
      rolActor: 'MODERADOR',
      instante: rechazo!.instante,
      caja,
    });

    const bloqueo = conDuplicado.procesada.find((p) => p.codigoCategoria === 'bloqueo')!;
    expect(conDuplicado.base.filter((p) => p.idReporte === bloqueo.idReporte)).toHaveLength(2);
    expect(conDuplicado.procesada.filter((p) => p.codigoCategoria === 'bloqueo')).toHaveLength(1);
    const categorias = (v: typeof trasRechazo) => [
      ...v.procesada.map((p) => p.codigoCategoria),
      ...v.base.map((p) => p.codigoCategoria),
    ];
    expect(categorias(trasRechazo)).not.toContain('jauria');
    // El accidente resuelto ya no está en la procesada, pero su envío sigue en la base.
    expect(trasRechazo.procesada.map((p) => p.codigoCategoria)).not.toContain('accidente');
    expect(trasRechazo.base.map((p) => p.codigoCategoria)).toContain('accidente');
  });
});
