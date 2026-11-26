/**
 * Tarea cronometrada (ADR-007): el participante toca, sobre una instantánea, cada incidente vigente
 * distinto que ve. Se guardan los toques; aciertos, omisiones y marcados de más se calculan en el
 * análisis, contra la clave que sale del etiquetado y la verificación.
 */

/** Límite de cada tarea. */
export const DURACION_DE_TAREA_MS = 180_000;

export type Vista = 'PROCESADA' | 'BASE';

/** Las dos instantáneas del piloto se congelan con estos nombres. */
export type Escenario = 'E1' | 'E2';

export type NumeroDeSecuencia = 1 | 2 | 3 | 4;

export interface Asignacion {
  readonly vista: Vista;
  readonly escenario: Escenario;
}

/**
 * Secuencias contrabalanceadas: cada participante ve las dos vistas y los dos escenarios, una vez
 * cada uno, y el orden de vista y de escenario se alterna entre secuencias.
 */
export const SECUENCIAS: Readonly<Record<NumeroDeSecuencia, readonly [Asignacion, Asignacion]>> = {
  1: [
    { vista: 'BASE', escenario: 'E1' },
    { vista: 'PROCESADA', escenario: 'E2' },
  ],
  2: [
    { vista: 'PROCESADA', escenario: 'E1' },
    { vista: 'BASE', escenario: 'E2' },
  ],
  3: [
    { vista: 'BASE', escenario: 'E2' },
    { vista: 'PROCESADA', escenario: 'E1' },
  ],
  4: [
    { vista: 'PROCESADA', escenario: 'E2' },
    { vista: 'BASE', escenario: 'E1' },
  ],
};

/** Código anónimo de participante: `P` y dos o tres dígitos (`P07`, `P112`). Nunca un nombre. */
export const CODIGO_DE_PARTICIPANTE = /^P\d{2,3}$/;

export interface Marca {
  readonly idPunto: string;
  readonly msDesdeInicio: number;
}

export interface Tarea {
  readonly id: string;
  readonly idSesion: string;
  readonly orden: 1 | 2;
  readonly vista: Vista;
  readonly escenario: Escenario;
  readonly idInstantanea: string;
  readonly iniciadaEn: Date | null;
  readonly terminadaEn: Date | null;
  /** Tiempo usado, con el límite de 180 s. */
  readonly duracionMs: number | null;
  /** Si se acabó el tiempo antes de terminar. */
  readonly agotada: boolean | null;
  readonly marcas: readonly Marca[];
}

export interface Sesion {
  readonly id: string;
  readonly codigoParticipante: string;
  readonly secuencia: NumeroDeSecuencia;
  readonly creadaEn: Date;
  readonly tareas: readonly [Tarea, Tarea];
}

export interface CierreDeTarea {
  readonly terminadaEn: Date;
  readonly duracionMs: number;
  readonly agotada: boolean;
  readonly marcas: readonly Marca[];
}

/**
 * Cierra una tarea iniciada. El tiempo lo mide el servidor: entre el inicio y el cierre, con el
 * límite de 180 s. De las marcas del cliente quedan solo las de un punto de la vista, una por
 * punto (la primera) y dentro del tiempo usado.
 */
export function cerrarTarea(
  iniciadaEn: Date,
  ahora: Date,
  marcas: readonly Marca[],
  puntosDeLaVista: ReadonlySet<string>,
): CierreDeTarea {
  const transcurrido = Math.max(0, ahora.getTime() - iniciadaEn.getTime());
  const duracionMs = Math.min(transcurrido, DURACION_DE_TAREA_MS);
  const enTiempo = marcas
    .filter(
      (m) =>
        puntosDeLaVista.has(m.idPunto) && m.msDesdeInicio >= 0 && m.msDesdeInicio <= duracionMs,
    )
    .toSorted((a, b) => a.msDesdeInicio - b.msDesdeInicio);
  const primeraPorPunto = new Map<string, Marca>();
  for (const marca of enTiempo) {
    if (!primeraPorPunto.has(marca.idPunto)) primeraPorPunto.set(marca.idPunto, marca);
  }
  const validas = [...primeraPorPunto.values()];
  return {
    terminadaEn: ahora,
    duracionMs,
    agotada: transcurrido >= DURACION_DE_TAREA_MS,
    marcas: validas,
  };
}

/**
 * Perfil v5, 6.3: las cuatro secuencias se asignan al azar, cinco participantes por secuencia. Se
 * sortea entre las secuencias que llevan menos sesiones, así ninguna se adelanta a las demás.
 * `azar` devuelve un número en `[0, 1)`.
 */
export function secuenciaEquilibrada(
  asignadas: readonly NumeroDeSecuencia[],
  azar: () => number,
): NumeroDeSecuencia {
  const todas: NumeroDeSecuencia[] = [1, 2, 3, 4];
  const cuenta = (s: NumeroDeSecuencia) => asignadas.filter((a) => a === s).length;
  const minimo = Math.min(...todas.map(cuenta));
  const candidatas = todas.filter((s) => cuenta(s) === minimo);
  return candidatas[Math.floor(azar() * candidatas.length)]!;
}
