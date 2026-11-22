import type { EventoDeIntegracion } from '@gis/contracts';
import type { BusDeEventos } from '@gis/event-bus';
import type { Registro } from '@gis/platform';

export interface TareaProgramada {
  readonly nombre: string;
  /** Pausa máxima entre ejecuciones, aunque la tarea no pida otra fecha. */
  readonly respaldoMs: number;
  /** Ejecuta la tarea y devuelve cuándo conviene la siguiente; `null`, solo el respaldo. */
  ejecutar(): Promise<Date | null>;
}

/** Espera mínima entre ejecuciones: una fecha ya pasada no provoca un bucle. */
export const ESPERA_MINIMA_MS = 1000;
/** Espera tras un fallo, por ejemplo con la base caída. */
export const ESPERA_TRAS_FALLO_MS = 5 * 60_000;

interface Programada {
  readonly tarea: TareaProgramada;
  temporizador: NodeJS.Timeout | null;
  /** Momento (ms) de la próxima ejecución programada. */
  objetivo: number;
}

/**
 * Ejecuta tareas dentro del proceso de la API, como la caducidad de reportes (HU-04). Cada tarea
 * corre al programarla y después en la fecha que ella misma pide, con un respaldo largo: así no
 * consulta la base a intervalos cortos y Neon puede suspender su cómputo (RSK-02). Una ejecución no
 * empieza si la anterior sigue en curso, y un fallo se registra sin detener la tarea.
 */
export class ProgramadorDeTareas {
  private readonly programadas = new Map<string, Programada>();
  private readonly enCurso = new Map<string, Promise<void>>();
  private activo = true;

  constructor(private readonly registro: Registro) {}

  /** Registra la tarea y la ejecuta enseguida. */
  programar(tarea: TareaProgramada): void {
    this.programadas.set(tarea.nombre, { tarea, temporizador: null, objetivo: Infinity });
    this.programarEn(tarea.nombre, 0);
  }

  /** Adelanta la próxima ejecución si `fecha` es anterior a la ya programada. */
  adelantar(nombre: string, fecha: Date): void {
    const programada = this.programadas.get(nombre);
    if (!this.activo || !programada || fecha.getTime() >= programada.objetivo) return;
    this.programarEn(nombre, Math.max(ESPERA_MINIMA_MS, fecha.getTime() - Date.now()));
  }

  /** Ejecuta la tarea ahora, salvo que ya esté en curso, y programa la siguiente. */
  ejecutar(tarea: TareaProgramada): Promise<void> {
    const actual = this.enCurso.get(tarea.nombre);
    if (actual) return actual;
    const ejecucion = tarea
      .ejecutar()
      .then((siguiente) => {
        this.registro.debug({ tarea: tarea.nombre, siguiente }, 'tarea ejecutada');
        const espera = siguiente ? siguiente.getTime() - Date.now() : tarea.respaldoMs;
        this.programarEn(tarea.nombre, Math.max(ESPERA_MINIMA_MS, espera));
      })
      .catch((error: unknown) => {
        this.registro.error({ err: error, tarea: tarea.nombre }, 'falló una tarea');
        this.programarEn(tarea.nombre, ESPERA_TRAS_FALLO_MS);
      })
      .finally(() => this.enCurso.delete(tarea.nombre));
    this.enCurso.set(tarea.nombre, ejecucion);
    return ejecucion;
  }

  /** Deja de programar y espera a las ejecuciones en curso. */
  async detener(): Promise<void> {
    this.activo = false;
    for (const programada of this.programadas.values()) {
      if (programada.temporizador) clearTimeout(programada.temporizador);
      programada.temporizador = null;
    }
    await Promise.all(this.enCurso.values());
  }

  private programarEn(nombre: string, esperaMs: number): void {
    const programada = this.programadas.get(nombre);
    if (!this.activo || !programada) return;
    if (programada.temporizador) clearTimeout(programada.temporizador);
    const espera = Math.min(esperaMs, programada.tarea.respaldoMs);
    programada.objetivo = Date.now() + espera;
    programada.temporizador = setTimeout(() => void this.ejecutar(programada.tarea), espera);
    programada.temporizador.unref();
  }
}

/** Eventos cuya nueva caducidad puede ser anterior a la ya programada. */
export const EVENTOS_CON_CADUCIDAD = [
  'ReporteCreado.v1',
  'ReporteCreado.v2',
  'ReporteConfirmado.v1',
  'ReporteExtendido.v1',
] as const;

/** Adelanta la tarea de caducidad cuando un reporte nuevo o extendido vence antes (HU-04). */
export function suscribirReprogramacionDeCaducidad(
  bus: BusDeEventos,
  programador: Pick<ProgramadorDeTareas, 'adelantar'>,
  nombreDeTarea: string,
): void {
  const manejar = (evento: EventoDeIntegracion): void => {
    const { caducaEn } = evento.contenido as { caducaEn?: unknown };
    if (typeof caducaEn === 'string') programador.adelantar(nombreDeTarea, new Date(caducaEn));
  };
  for (const clave of EVENTOS_CON_CADUCIDAD) {
    bus.suscribir(clave, 'api.reprogramar-caducidad', manejar);
  }
}
