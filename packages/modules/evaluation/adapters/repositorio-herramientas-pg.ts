import type { Db } from '@gis/platform';
import { esClaveDuplicada } from '@gis/platform';
import { ErrorConflicto } from '@gis/shared-kernel';
import { and, asc, desc, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import type { Etiqueta, Evaluador } from '../domain/etiquetado.js';
import type {
  Asignacion,
  RepositorioDeEtiquetas,
  RepositorioDeSesiones,
  RepositorioDeVerificaciones,
} from '../domain/ports.js';
import type {
  CierreDeTarea,
  Escenario,
  NumeroDeSecuencia,
  Sesion,
  Tarea,
  Vista,
} from '../domain/tarea.js';
import type {
  FuenteDeVerificacion,
  ResultadoDeVerificacion,
  Verificacion,
} from '../domain/verificacion.js';
import {
  evaluacionEtiquetas as etiquetas,
  evaluacionMarcas as marcas,
  evaluacionSesiones as sesiones,
  evaluacionTareas as tareas,
  evaluacionVerificaciones as verificaciones,
} from './schema.js';

type FilaDeTarea = typeof tareas.$inferSelect;

/** Sesiones y tareas en PostgreSQL. Inicio y cierre son condicionales: solo la primera vez. */
export class RepositorioSesionesPg implements RepositorioDeSesiones {
  constructor(private readonly db: Db) {}

  async crear(sesion: Sesion): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(sesiones).values({
          id: sesion.id,
          codigoParticipante: sesion.codigoParticipante,
          secuencia: sesion.secuencia,
          creadaEn: sesion.creadaEn,
        });
        await tx.insert(tareas).values(
          sesion.tareas.map((t) => ({
            id: t.id,
            idSesion: sesion.id,
            orden: t.orden,
            vista: t.vista,
            escenario: t.escenario,
            idInstantanea: t.idInstantanea,
          })),
        );
      });
    } catch (error) {
      if (esClaveDuplicada(error, 'evaluacion_sesiones_codigo_participante_unique')) {
        throw new ErrorConflicto(
          'PARTICIPANTE_REPETIDO',
          `El participante ${sesion.codigoParticipante} ya tiene sesión`,
        );
      }
      throw error;
    }
  }

  async listar(): Promise<readonly Sesion[]> {
    const filas = await this.db.select().from(sesiones).orderBy(desc(sesiones.creadaEn));
    return this.conTareas(filas);
  }

  async buscarPorTarea(idTarea: string): Promise<Sesion | null> {
    const filas = await this.db
      .select({ sesion: sesiones })
      .from(sesiones)
      .innerJoin(tareas, eq(tareas.idSesion, sesiones.id))
      .where(eq(tareas.id, idTarea));
    const [sesion] = await this.conTareas(filas.map((f) => f.sesion));
    return sesion ?? null;
  }

  async hayTareasIniciadas(idInstantanea: string): Promise<boolean> {
    const [fila] = await this.db
      .select({ id: tareas.id })
      .from(tareas)
      .where(and(eq(tareas.idInstantanea, idInstantanea), isNotNull(tareas.iniciadaEn)))
      .limit(1);
    return fila !== undefined;
  }

  async iniciar(idTarea: string, en: Date): Promise<boolean> {
    const filas = await this.db
      .update(tareas)
      .set({ iniciadaEn: en })
      .where(and(eq(tareas.id, idTarea), isNull(tareas.iniciadaEn)))
      .returning({ id: tareas.id });
    return filas.length > 0;
  }

  async cerrar(idTarea: string, cierre: CierreDeTarea): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const filas = await tx
        .update(tareas)
        .set({
          terminadaEn: cierre.terminadaEn,
          duracionMs: cierre.duracionMs,
          agotada: cierre.agotada,
        })
        .where(
          and(eq(tareas.id, idTarea), isNotNull(tareas.iniciadaEn), isNull(tareas.terminadaEn)),
        )
        .returning({ id: tareas.id });
      if (filas.length === 0) return false;
      if (cierre.marcas.length > 0) {
        await tx.insert(marcas).values(cierre.marcas.map((m) => ({ idTarea, ...m })));
      }
      return true;
    });
  }

  private async conTareas(filas: (typeof sesiones.$inferSelect)[]): Promise<Sesion[]> {
    if (filas.length === 0) return [];
    const ids = filas.map((f) => f.id);
    const [deTareas, deMarcas] = await Promise.all([
      this.db.select().from(tareas).where(inArray(tareas.idSesion, ids)).orderBy(asc(tareas.orden)),
      this.db
        .select({
          idTarea: marcas.idTarea,
          idPunto: marcas.idPunto,
          msDesdeInicio: marcas.msDesdeInicio,
        })
        .from(marcas)
        .innerJoin(tareas, eq(tareas.id, marcas.idTarea))
        .where(inArray(tareas.idSesion, ids))
        .orderBy(asc(marcas.msDesdeInicio)),
    ]);
    const aTarea = (t: FilaDeTarea): Tarea => ({
      id: t.id,
      idSesion: t.idSesion,
      orden: t.orden as 1 | 2,
      vista: t.vista as Vista,
      escenario: t.escenario as Escenario,
      idInstantanea: t.idInstantanea,
      iniciadaEn: t.iniciadaEn,
      terminadaEn: t.terminadaEn,
      duracionMs: t.duracionMs,
      agotada: t.agotada,
      marcas: deMarcas
        .filter((m) => m.idTarea === t.id)
        .map(({ idPunto, msDesdeInicio }) => ({ idPunto, msDesdeInicio })),
    });
    return filas.map((f) => {
      const [primera, segunda] = deTareas.filter((t) => t.idSesion === f.id).map(aTarea);
      return {
        id: f.id,
        codigoParticipante: f.codigoParticipante,
        secuencia: f.secuencia as NumeroDeSecuencia,
        creadaEn: f.creadaEn,
        tareas: [primera!, segunda!],
      };
    });
  }
}

/** Etiquetas del etiquetado ciego. Un grupo nulo borra la etiqueta del envío. */
export class RepositorioEtiquetasPg implements RepositorioDeEtiquetas {
  constructor(private readonly db: Db) {}

  async guardar(evaluador: Evaluador, asignaciones: readonly Asignacion[]): Promise<void> {
    const conGrupo = asignaciones.filter(
      (a): a is Asignacion & { grupo: string } => a.grupo !== null,
    );
    const sinGrupo = asignaciones.filter((a) => a.grupo === null).map((a) => a.idEnvio);
    await this.db.transaction(async (tx) => {
      if (sinGrupo.length > 0) {
        await tx
          .delete(etiquetas)
          .where(and(eq(etiquetas.evaluador, evaluador), inArray(etiquetas.idEnvio, sinGrupo)));
      }
      if (conGrupo.length > 0) {
        await tx
          .insert(etiquetas)
          .values(conGrupo.map((a) => ({ evaluador, idEnvio: a.idEnvio, grupo: a.grupo })))
          .onConflictDoUpdate({
            target: [etiquetas.evaluador, etiquetas.idEnvio],
            set: { grupo: sql`excluded.grupo` },
          });
      }
    });
  }

  async buscar(idsEnvio: readonly string[]): Promise<readonly Etiqueta[]> {
    if (idsEnvio.length === 0) return [];
    const filas = await this.db
      .select()
      .from(etiquetas)
      .where(inArray(etiquetas.idEnvio, [...idsEnvio]))
      .orderBy(asc(etiquetas.evaluador), asc(etiquetas.idEnvio));
    return filas.map((f) => ({ ...f, evaluador: f.evaluador as Evaluador }));
  }
}

/** Verificaciones: la última registrada de un reporte reemplaza a la anterior. */
export class RepositorioVerificacionesPg implements RepositorioDeVerificaciones {
  constructor(private readonly db: Db) {}

  async guardar(verificacion: Verificacion): Promise<void> {
    const { resultado, finEn, fuente, detalleFuente, registradaEn } = verificacion;
    await this.db.insert(verificaciones).values(verificacion).onConflictDoUpdate({
      target: verificaciones.idReporte,
      set: { resultado, finEn, fuente, detalleFuente, registradaEn },
    });
  }

  async listar(): Promise<readonly Verificacion[]> {
    const filas = await this.db
      .select()
      .from(verificaciones)
      .orderBy(desc(verificaciones.registradaEn), asc(verificaciones.idReporte));
    return filas.map((f) => ({
      ...f,
      resultado: f.resultado as ResultadoDeVerificacion,
      fuente: f.fuente as FuenteDeVerificacion,
    }));
  }
}
