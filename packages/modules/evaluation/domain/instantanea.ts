import type { Caja, Vistas } from './vistas.js';

/** Largo máximo del nombre de una instantánea (`E1`, `E2`, `ensayo-centro`...). */
export const MAX_NOMBRE_DE_INSTANTANEA = 40;

/**
 * ADR-007: el contenido de ambas vistas de una zona en un instante, congelado. Es inmutable: las
 * tareas cronometradas usan instantáneas, nunca datos en vivo.
 */
export interface Instantanea extends Vistas {
  readonly id: string;
  readonly nombre: string;
  readonly creadaEn: Date;
  /**
   * La respuesta correcta de la tarea: los incidentes activos (grupos del etiquetado) que fijan los
   * dos evaluadores antes de las sesiones (perfil v5, 6.3). Vacía hasta que la fijan.
   */
  readonly clave: readonly string[];
}

export interface ResumenDeInstantanea {
  readonly id: string;
  readonly nombre: string;
  readonly instante: Date;
  readonly caja: Caja;
  readonly creadaEn: Date;
  readonly puntosProcesada: number;
  readonly puntosBase: number;
  readonly clave: readonly string[];
}

/** Perfil v5, 6.3: cada escenario tiene de 3 a 6 incidentes activos reales... */
export const INCIDENTES_POR_ESCENARIO = { minimo: 3, maximo: 6 } as const;

/** ...y los dos escenarios no difieren en más de un 20 % de reportes. */
export const MAXIMA_DIFERENCIA_DE_REPORTES = 0.2;

/** Tope de incidentes en una clave: holgado frente a los 6 del perfil, para no bloquear un ensayo. */
export const MAX_GRUPOS_EN_CLAVE = 20;

/**
 * Avisos de los criterios del perfil sobre E1 y E2 (no bloquean: el investigador decide). La
 * diferencia de reportes se mide sobre la vista base, que muestra cada reporte.
 */
export function avisosDeEscenarios(
  e1: Pick<ResumenDeInstantanea, 'clave' | 'puntosBase'> | undefined,
  e2: Pick<ResumenDeInstantanea, 'clave' | 'puntosBase'> | undefined,
): string[] {
  const avisos: string[] = [];
  const { minimo, maximo } = INCIDENTES_POR_ESCENARIO;
  for (const [nombre, e] of [
    ['E1', e1],
    ['E2', e2],
  ] as const) {
    if (!e) avisos.push(`Falta congelar ${nombre}.`);
    else if (e.clave.length < minimo || e.clave.length > maximo) {
      avisos.push(
        `La clave de ${nombre} tiene ${e.clave.length} incidentes; el perfil pide de ${minimo} a ${maximo}.`,
      );
    }
  }
  if (e1 && e2 && Math.max(e1.puntosBase, e2.puntosBase) > 0) {
    const diferencia =
      Math.abs(e1.puntosBase - e2.puntosBase) / Math.max(e1.puntosBase, e2.puntosBase);
    if (diferencia > MAXIMA_DIFERENCIA_DE_REPORTES) {
      avisos.push(
        `E1 y E2 difieren en un ${Math.round(diferencia * 100)} % de reportes; el perfil pide 20 % o menos.`,
      );
    }
  }
  return avisos;
}
