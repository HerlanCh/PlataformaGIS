import { claveDeEvento } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { BusDeEventos, Desuscribir, ManejadorDeEvento } from '@gis/event-bus';
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Db, Ejecutor } from './database.js';
import type { Registro } from './logger.js';
import { agregarASalida } from './outbox.js';
import { eventosProcesados, eventosSalida } from './schema.js';

/**
 * Implementación definitiva del puerto `BusDeEventos` (patrón outbox): publicar escribe en
 * `eventos_salida` y el `DespachadorDeSalida` entrega cada evento a sus manejadores.
 */
export class BusDeEventosConSalida implements BusDeEventos {
  private readonly porClave = new Map<string, Map<string, ManejadorDeEvento>>();

  constructor(private readonly db: Ejecutor) {}

  publicar(evento: EventoDeIntegracion): Promise<void> {
    return agregarASalida(this.db, [evento]);
  }

  /** @throws {Error} si ya hay un manejador con ese nombre para esa clave. */
  suscribir(clave: string, nombre: string, manejador: ManejadorDeEvento): Desuscribir {
    const manejadores = this.porClave.get(clave) ?? new Map<string, ManejadorDeEvento>();
    if (manejadores.has(nombre)) throw new Error(`"${nombre}" ya escucha ${clave}`);
    manejadores.set(nombre, manejador);
    this.porClave.set(clave, manejadores);
    return () => {
      manejadores.delete(nombre);
    };
  }

  /** Manejadores de una clave, con su nombre. */
  manejadoresDe(clave: string): [string, ManejadorDeEvento][] {
    return [...(this.porClave.get(clave) ?? [])];
  }
}

export interface OpcionesDelDespachador {
  readonly registro: Registro;
  /** Pausa entre pasadas cuando no quedan pendientes. */
  readonly intervaloMs?: number;
  /** Eventos por pasada. */
  readonly lote?: number;
  /** Entregas fallidas tras las que el evento se da por perdido. */
  readonly maxIntentos?: number;
  /** Reportes cuyos eventos se entregan a la vez dentro de un lote. */
  readonly concurrencia?: number;
}

type Fila = typeof eventosSalida.$inferSelect;

/** Espera antes del reintento `n`: 2^n segundos, hasta 5 minutos. */
export const esperaDeReintentoS = (intentos: number): number => Math.min(300, 2 ** intentos);

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Agrupa un lote por reporte, conservando el orden dentro de cada grupo: los eventos de un mismo
 * reporte se entregan en orden y los de reportes distintos, en paralelo.
 */
function agruparPorReporte(filas: readonly Fila[]): Fila[][] {
  const grupos = new Map<string, Fila[]>();
  for (const fila of filas) {
    const contenido = (fila.contenido as EventoDeIntegracion).contenido as { idReporte?: unknown };
    const clave = typeof contenido?.idReporte === 'string' ? contenido.idReporte : fila.id;
    grupos.set(clave, [...(grupos.get(clave) ?? []), fila]);
  }
  return [...grupos.values()];
}

/** Procesa los elementos con a lo sumo `limite` tareas a la vez. */
async function enParalelo<T>(
  elementos: readonly T[],
  limite: number,
  tarea: (elemento: T) => Promise<void>,
): Promise<void> {
  let siguiente = 0;
  const trabajador = async (): Promise<void> => {
    while (siguiente < elementos.length) {
      const elemento = elementos[siguiente]!;
      siguiente += 1;
      await tarea(elemento);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, elementos.length) }, trabajador));
}

/**
 * Entrega los eventos del outbox al menos una vez. Cada pasada toma los pendientes en orden con
 * `FOR UPDATE SKIP LOCKED` (dos procesos nunca entregan el mismo evento a la vez) y los pasa a
 * cada manejador que todavía no lo procesó según `eventos_procesados`. Un evento queda publicado
 * cuando todos sus manejadores terminaron; si alguno falla, se reintenta con espera exponencial.
 */
export class DespachadorDeSalida {
  private readonly intervaloMs: number;
  private readonly lote: number;
  private readonly maxIntentos: number;
  private readonly concurrencia: number;
  private temporizador: NodeJS.Timeout | null = null;
  private pasada: Promise<unknown> = Promise.resolve();
  private activo = false;

  constructor(
    private readonly db: Db,
    private readonly bus: BusDeEventosConSalida,
    private readonly opciones: OpcionesDelDespachador,
  ) {
    this.intervaloMs = opciones.intervaloMs ?? 250;
    this.lote = opciones.lote ?? 100;
    this.maxIntentos = opciones.maxIntentos ?? 10;
    this.concurrencia = opciones.concurrencia ?? 8;
  }

  iniciar(): void {
    if (this.activo) return;
    this.activo = true;
    this.programar(0);
  }

  /** Deja de programar pasadas y espera a que termine la que está en curso. */
  async detener(): Promise<void> {
    this.activo = false;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    await this.pasada;
  }

  /** Una pasada: entrega hasta un lote de pendientes. Devuelve cuántos tomó. */
  despacharPendientes(): Promise<number> {
    return this.db.transaction(async (tx) => {
      const filas = await tx
        .select()
        .from(eventosSalida)
        .where(
          and(
            isNull(eventosSalida.publicadoEn),
            or(isNull(eventosSalida.proximoIntento), lte(eventosSalida.proximoIntento, sql`now()`)),
          ),
        )
        .orderBy(asc(eventosSalida.creadoEn), asc(eventosSalida.id))
        .limit(this.lote)
        .for('update', { skipLocked: true });
      const entregados: string[] = [];
      await enParalelo(agruparPorReporte(filas), this.concurrencia, async (grupo) => {
        for (const fila of grupo) {
          const errores = await this.entregar(fila);
          if (errores.length === 0) entregados.push(fila.id);
          else await this.registrarFallo(tx, fila, errores);
        }
      });
      // Los entregados se marcan juntos: una sola escritura por lote.
      if (entregados.length > 0) {
        await tx
          .update(eventosSalida)
          .set({ publicadoEn: sql`now()`, ultimoError: null })
          .where(inArray(eventosSalida.id, entregados));
      }
      return filas.length;
    });
  }

  private programar(esperaMs: number): void {
    if (!this.activo) return;
    this.temporizador = setTimeout(() => {
      const pasada = this.despacharPendientes().catch((error: unknown) => {
        this.opciones.registro.error({ err: error }, 'falló una pasada del despachador');
        return 0;
      });
      this.pasada = pasada;
      // Si el lote vino lleno quedan más pendientes: se sigue sin esperar.
      void pasada.then((tomados) => this.programar(tomados >= this.lote ? 0 : this.intervaloMs));
    }, esperaMs);
  }

  /** Pasa el evento a cada manejador que aún no lo procesó. Devuelve los errores. */
  private async entregar(fila: Fila): Promise<string[]> {
    const evento = fila.contenido as EventoDeIntegracion;
    const procesados = new Set(
      (
        await this.db
          .select({ manejador: eventosProcesados.manejador })
          .from(eventosProcesados)
          .where(eq(eventosProcesados.idEvento, fila.id))
      ).map((p) => p.manejador),
    );

    const errores: string[] = [];
    for (const [nombre, manejador] of this.bus.manejadoresDe(claveDeEvento(evento))) {
      if (procesados.has(nombre)) continue;
      try {
        await manejador(evento);
        // Fuera de la transacción del lote: si el proceso muere después, no se repite.
        await this.db
          .insert(eventosProcesados)
          .values({ idEvento: fila.id, manejador: nombre })
          .onConflictDoNothing();
      } catch (error) {
        errores.push(`${nombre}: ${mensajeDe(error)}`);
      }
    }
    return errores;
  }

  private async registrarFallo(tx: Ejecutor, fila: Fila, errores: string[]): Promise<void> {
    const intentos = fila.intentos + 1;
    const ultimoError = errores.join('; ');
    const agotado = intentos >= this.maxIntentos;
    const contexto = { evento: fila.id, tipo: fila.tipo, intentos, error: ultimoError };
    if (agotado) {
      this.opciones.registro.error(contexto, 'evento descartado tras agotar los reintentos');
    } else {
      this.opciones.registro.warn(contexto, 'falló la entrega de un evento; se reintentará');
    }
    await tx
      .update(eventosSalida)
      .set({
        intentos,
        ultimoError,
        // Agotado: se marca publicado para que no bloquee la cola; queda el error para revisarlo.
        publicadoEn: agotado ? sql`now()` : null,
        proximoIntento: sql`now() + make_interval(secs => ${esperaDeReintentoS(intentos)})`,
      })
      .where(eq(eventosSalida.id, fila.id));
  }
}
