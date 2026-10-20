import type { IdReporte, Marca } from '@gis/shared-kernel';

export type IdClasificacion = Marca<string, 'IdClasificacion'>;

/** Indicios de que un reporte puede ser falso o violar la regla ética (HU-10). */
export type MotivoDeSospecha =
  | 'ENLACE'
  | 'SPAM'
  | 'DATOS_PERSONALES'
  | 'FRECUENCIA_DEL_AUTOR'
  | 'TEXTO_REPETITIVO'
  | 'LONGITUD_ANORMAL';

/** Lo que se sabe de un reporte al clasificarlo. */
export interface DatosParaClasificar {
  /** Descripción privada del autor; `null` si no la escribió. */
  readonly descripcion: string | null;
  /** Reportes del mismo autor en la hora anterior al reporte, incluido este. */
  readonly reportesRecientesDelAutor: number;
}

export interface Clasificacion {
  readonly sospechoso: boolean;
  readonly motivos: readonly MotivoDeSospecha[];
  /** Entre 0 y 1: cuánto se parece a un reporte que se debe revisar. */
  readonly puntaje: number;
  /** Qué implementación decidió, por ejemplo `reglas-v1`. */
  readonly clasificador: string;
}

/**
 * `ClassifierPort` del roadmap: decide si un reporte merece revisión. Lo implementan las reglas
 * locales y, desde la Fase 13, un modelo de IA; el resto del módulo no distingue cuál es.
 */
export interface Clasificador {
  clasificar(datos: DatosParaClasificar): Promise<Clasificacion>;
}

/** Resultado guardado de una clasificación. Solo se inserta: es el historial del reporte. */
export interface RegistroDeClasificacion extends Clasificacion {
  readonly id: IdClasificacion;
  readonly idReporte: IdReporte;
  readonly creadoEn: Date;
}
