import type { Registro } from '@gis/platform';

export interface TareaPeriodica {
  readonly nombre: string;
  readonly intervaloMs: number;
  ejecutar(): Promise<unknown>;
}

/**
 * Ejecuta tareas periódicas dentro del proceso de la API, como la caducidad de reportes (HU-04).
 * Una ejecución no empieza si la anterior sigue en curso, y un fallo se registra sin detener la
 * tarea.
 */
export class ProgramadorDeTareas {
  private readonly temporizadores: NodeJS.Timeout[] = [];
  private readonly enCurso = new Map<string, Promise<void>>();

  constructor(private readonly registro: Registro) {}

  programar(tarea: TareaPeriodica): void {
    const temporizador = setInterval(() => void this.ejecutar(tarea), tarea.intervaloMs);
    temporizador.unref();
    this.temporizadores.push(temporizador);
  }

  /** Ejecuta la tarea ahora, salvo que ya esté en curso. */
  ejecutar(tarea: TareaPeriodica): Promise<void> {
    const actual = this.enCurso.get(tarea.nombre);
    if (actual) return actual;
    const ejecucion = tarea
      .ejecutar()
      .then((resultado) =>
        this.registro.debug({ tarea: tarea.nombre, resultado }, 'tarea ejecutada'),
      )
      .catch((error: unknown) =>
        this.registro.error({ err: error, tarea: tarea.nombre }, 'falló una tarea'),
      )
      .finally(() => this.enCurso.delete(tarea.nombre));
    this.enCurso.set(tarea.nombre, ejecucion);
    return ejecucion;
  }

  /** Deja de programar y espera a las ejecuciones en curso. */
  async detener(): Promise<void> {
    for (const temporizador of this.temporizadores.splice(0)) clearInterval(temporizador);
    await Promise.all(this.enCurso.values());
  }
}
