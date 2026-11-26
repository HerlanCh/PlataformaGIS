import type { Db } from '@gis/platform';
import { esClaveDuplicada } from '@gis/platform';
import { ErrorConflicto } from '@gis/shared-kernel';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Instantanea, ResumenDeInstantanea } from '../domain/instantanea.js';
import type { RepositorioDeInstantaneas } from '../domain/ports.js';
import type { PuntoBase, PuntoProcesado } from '../domain/vistas.js';
import {
  evaluacionClaves as claves,
  evaluacionInstantaneas as instantaneas,
  evaluacionPuntosInstantanea as puntos,
} from './schema.js';

type Fila = typeof instantaneas.$inferSelect;
type FilaDePunto = typeof puntos.$inferInsert;

const cajaDe = (fila: Fila) => ({
  latitudMin: fila.latitudMin,
  latitudMax: fila.latitudMax,
  longitudMin: fila.longitudMin,
  longitudMax: fila.longitudMax,
});

const aPunto = ({ latitud, longitud }: { latitud: number; longitud: number }) => ({
  x: longitud,
  y: latitud,
});

function filasDePuntos(instantanea: Instantanea): FilaDePunto[] {
  const comun = { idInstantanea: instantanea.id };
  return [
    ...instantanea.procesada.map((p) => ({
      ...comun,
      vista: 'PROCESADA',
      idPunto: p.idReporte,
      idReporte: p.idReporte,
      codigoCategoria: p.codigoCategoria,
      publicLocation: aPunto(p.publicLocation),
      estado: p.estado,
      caducaEn: p.caducaEn,
      fuenteOficial: p.fuenteOficial,
    })),
    ...instantanea.base.map((p) => ({
      ...comun,
      vista: 'BASE',
      idPunto: p.idEnvio,
      idReporte: p.idReporte,
      codigoCategoria: p.codigoCategoria,
      publicLocation: aPunto(p.publicLocation),
      recibidoEn: p.recibidoEn,
      fuenteOficial: p.fuenteOficial,
    })),
  ];
}

/** Instantáneas en PostgreSQL. La instantánea y sus puntos se guardan juntos o no se guardan. */
export class RepositorioInstantaneasPg implements RepositorioDeInstantaneas {
  constructor(private readonly db: Db) {}

  async guardar(instantanea: Instantanea): Promise<void> {
    const { caja } = instantanea;
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(instantaneas).values({
          id: instantanea.id,
          nombre: instantanea.nombre,
          instante: instantanea.instante,
          ...caja,
          creadaEn: instantanea.creadaEn,
        });
        const filas = filasDePuntos(instantanea);
        if (filas.length > 0) await tx.insert(puntos).values(filas);
      });
    } catch (error) {
      if (esClaveDuplicada(error, 'evaluacion_instantaneas_nombre_unique')) {
        throw new ErrorConflicto(
          'NOMBRE_REPETIDO',
          `Ya hay una instantánea «${instantanea.nombre}»`,
        );
      }
      throw error;
    }
  }

  async listar(): Promise<readonly ResumenDeInstantanea[]> {
    const conteo = (vista: string) =>
      sql<number>`(select count(*)::int from ${puntos}
        where ${puntos.idInstantanea} = ${instantaneas.id} and ${puntos.vista} = ${vista})`;
    const filas = await this.db
      .select({
        fila: instantaneas,
        puntosProcesada: conteo('PROCESADA'),
        puntosBase: conteo('BASE'),
      })
      .from(instantaneas)
      .orderBy(desc(instantaneas.creadaEn), asc(instantaneas.nombre));
    const clavesDe = await this.clavesDe(filas.map((f) => f.fila.id));
    return filas.map(({ fila, puntosProcesada, puntosBase }) => ({
      id: fila.id,
      nombre: fila.nombre,
      instante: fila.instante,
      caja: cajaDe(fila),
      creadaEn: fila.creadaEn,
      puntosProcesada,
      puntosBase,
      clave: clavesDe.get(fila.id) ?? [],
    }));
  }

  async buscarPorId(id: string): Promise<Instantanea | null> {
    const [fila] = await this.db.select().from(instantaneas).where(eq(instantaneas.id, id));
    if (!fila) return null;
    const filas = await this.db
      .select({
        vista: puntos.vista,
        idPunto: puntos.idPunto,
        idReporte: puntos.idReporte,
        codigoCategoria: puntos.codigoCategoria,
        latitud: sql<number>`st_y(${puntos.publicLocation})`,
        longitud: sql<number>`st_x(${puntos.publicLocation})`,
        estado: puntos.estado,
        caducaEn: puntos.caducaEn,
        recibidoEn: puntos.recibidoEn,
        fuenteOficial: puntos.fuenteOficial,
      })
      .from(puntos)
      .where(eq(puntos.idInstantanea, id))
      .orderBy(desc(puntos.recibidoEn), asc(puntos.idPunto));
    const procesada: PuntoProcesado[] = [];
    const base: PuntoBase[] = [];
    for (const p of filas) {
      const comun = {
        idReporte: p.idReporte,
        codigoCategoria: p.codigoCategoria,
        publicLocation: { latitud: p.latitud, longitud: p.longitud },
        fuenteOficial: p.fuenteOficial,
      };
      if (p.vista === 'PROCESADA') {
        procesada.push({
          ...comun,
          estado: p.estado as PuntoProcesado['estado'],
          caducaEn: p.caducaEn!,
        });
      } else {
        base.push({ ...comun, idEnvio: p.idPunto, recibidoEn: p.recibidoEn! });
      }
    }
    return {
      id: fila.id,
      nombre: fila.nombre,
      instante: fila.instante,
      caja: cajaDe(fila),
      creadaEn: fila.creadaEn,
      procesada: procesada.toSorted((a, b) => a.idReporte.localeCompare(b.idReporte)),
      base,
      clave: (await this.clavesDe([id])).get(id) ?? [],
    };
  }

  async buscarIdPorNombre(nombre: string): Promise<string | null> {
    const [fila] = await this.db
      .select({ id: instantaneas.id })
      .from(instantaneas)
      .where(eq(instantaneas.nombre, nombre));
    return fila?.id ?? null;
  }

  async fijarClave(id: string, grupos: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(claves).where(eq(claves.idInstantanea, id));
      if (grupos.length > 0) {
        await tx.insert(claves).values(grupos.map((grupo) => ({ idInstantanea: id, grupo })));
      }
    });
  }

  /** Los grupos de la clave de cada instantánea, en orden alfabético. */
  private async clavesDe(ids: readonly string[]): Promise<Map<string, string[]>> {
    const resultado = new Map<string, string[]>();
    if (ids.length === 0) return resultado;
    const filas = await this.db
      .select()
      .from(claves)
      .where(inArray(claves.idInstantanea, [...ids]))
      .orderBy(asc(claves.grupo));
    for (const { idInstantanea, grupo } of filas) {
      resultado.set(idInstantanea, [...(resultado.get(idInstantanea) ?? []), grupo]);
    }
    return resultado;
  }
}
