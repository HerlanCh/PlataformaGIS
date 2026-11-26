// Apoyo de las pruebas de integración de la evaluación (ADR-007): el flujo real de producción
// (casos de uso, outbox, despachador y manejadores) sobre PostGIS, con el reloj en la mano.
import { evaluationModulo } from '@gis/module-evaluation';
import { identityModulo } from '@gis/module-identity';
import { moderationModulo } from '@gis/module-moderation';
import {
  CaducarReportes,
  RepositorioReportesPostgis,
  reportsModulo,
  UnidadDeTrabajoReportePg,
} from '@gis/module-reports';
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
import type { PuntoGeo } from '@gis/shared-kernel';
import {
  createTestDatabase,
  GeneradorDeIdSecuencial,
  LimitadorEnMemoria,
  RelojFijo,
} from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { componerCasosDeUso } from '../composicion/casos-de-uso.js';
import type { CasosDeUso } from '../composicion/casos-de-uso.js';
import { suscribirManejadores } from '../composicion/manejadores.js';

export const usuario = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export interface Cadena {
  readonly base: TestDatabase;
  readonly db: Db;
  readonly casos: CasosDeUso;
  readonly reloj: RelojFijo;
  /** Entrega el outbox hasta vaciarlo, como el despachador en producción. */
  despachar(): Promise<void>;
  /** La tarea de caducidad, con el reloj de la prueba. */
  caducar(): Promise<void>;
  crear(autor: number, codigoCategoria: string, punto: PuntoGeo): Promise<string>;
  votar(
    sentido: 'confirmar' | 'negar',
    idReporte: string,
    votante: number,
    punto: PuntoGeo,
  ): Promise<unknown>;
  publicarOficial(codigoCategoria: string, punto: PuntoGeo): Promise<string>;
  rechazar(idReporte: string): Promise<void>;
}

/** Arma la cadena con `evaluation` y `moderation` activos. `prefijo` hace únicas las claves. */
export async function prepararCadena(prefijo: string): Promise<Cadena> {
  const base = await createTestDatabase();
  const db = crearDb(base.pool);
  await migrarTodo(db, [
    migracionesDePlataforma,
    ...[identityModulo, reportsModulo, verificationModulo, moderationModulo, evaluationModulo].map(
      (m) => m.migraciones!,
    ),
  ]);
  const reloj = new RelojFijo('2026-11-22T12:00:00.000Z');
  const ids = new GeneradorDeIdSecuencial('dddddddd');
  const interruptores = cargarInterruptores({
    FEATURE_EVALUATION: 'true',
    FEATURE_MODERATION: 'true',
  });
  const registro = crearRegistro('silent');
  const bus = new BusDeEventosConSalida(db);
  const casos = componerCasosDeUso({
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
  const despachador = new DespachadorDeSalida(db, bus, { registro });
  const caducidad = new CaducarReportes({
    reportes: new RepositorioReportesPostgis(db),
    unidadDeTrabajo: new UnidadDeTrabajoReportePg(db),
    reloj,
    ids,
  });
  let clave = 0;
  const nuevaClave = () => {
    clave += 1;
    return `${prefijo}-${String(clave).padStart(4, '0')}`;
  };
  /** Una pasada tras otra: cada una puede dejar eventos nuevos en el outbox. */
  const despachar = async (): Promise<void> => {
    if ((await despachador.despacharPendientes()) > 0) await despachar();
  };
  return {
    base,
    db,
    casos,
    reloj,
    despachar,
    async caducar() {
      await caducidad.ejecutar();
    },
    async crear(autor, codigoCategoria, punto) {
      const salida = await casos.crearReporte.ejecutar({
        idAutor: usuario(autor),
        codigoCategoria,
        latitud: punto.latitud,
        longitud: punto.longitud,
        idempotencyKey: nuevaClave(),
      });
      return salida.reporte.id;
    },
    votar: (sentido, idReporte, votante, punto) =>
      (sentido === 'confirmar' ? casos.confirmarReporte : casos.negarReporte).ejecutar({
        idReporte,
        idVotante: usuario(votante),
        latitud: punto.latitud,
        longitud: punto.longitud,
      }),
    async publicarOficial(codigoCategoria, punto) {
      const reporte = await casos.moderacion!.publicarOficial.ejecutar({
        idModerador: usuario(99),
        rolActor: 'MODERADOR',
        codigoCategoria,
        latitud: punto.latitud,
        longitud: punto.longitud,
        fuenteOficial: 'TRANSITO',
        idempotencyKey: nuevaClave(),
      });
      return reporte.id;
    },
    async rechazar(idReporte) {
      await casos.moderacion!.rechazar.ejecutar({
        idReporte,
        idModerador: usuario(99),
        rolActor: 'MODERADOR',
        motivo: 'Prueba de la evaluación',
      });
    },
  };
}
