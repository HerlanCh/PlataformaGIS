import type { Mensaje } from '../reporte/mensajes.js';
import { ErrorDeModeracion } from '../../services/moderacion.js';

/** Por qué el clasificador marcó un reporte (HU-10), en palabras de la persona que modera. */
export const TEXTO_DE_MOTIVO: Readonly<Record<string, string>> = {
  ENLACE: 'Tiene un enlace',
  SPAM: 'Parece publicidad',
  DATOS_PERSONALES: 'Puede identificar a una persona',
  FRECUENCIA_DEL_AUTOR: 'Su autor reportó muchas veces en una hora',
  TEXTO_REPETITIVO: 'Texto repetitivo',
  LONGITUD_ANORMAL: 'Texto de largo anormal',
};

export const textoDeMotivo = (motivo: string): string => TEXTO_DE_MOTIVO[motivo] ?? motivo;

/** Motivos frecuentes de rechazo; el último es la regla ética de la Fase 0 (HU-12, escenario 3). */
export const MOTIVOS_DE_RECHAZO: readonly string[] = [
  'Información falsa',
  'Publicidad o spam',
  'Identifica a una persona',
];

const MENSAJES_DE_ERROR: Readonly<Record<string, string>> = {
  REPORTE_NO_VIGENTE: 'Ese reporte ya no está vigente: salió de la cola.',
  REPORTE_NO_ENCONTRADO: 'Ese reporte ya no existe.',
  ROL_INSUFICIENTE: 'Tu cuenta ya no tiene el rol de moderación.',
};

const codigoDe = (error: unknown): string | undefined =>
  error instanceof ErrorDeModeracion ? error.rechazo?.codigo : undefined;

/** Qué decir cuando falla una decisión. */
export function mensajeDeDecision(error: unknown): Mensaje {
  const codigo = codigoDe(error);
  return {
    tono: 'problema',
    texto:
      (codigo && MENSAJES_DE_ERROR[codigo]) ??
      'No pudimos guardar la decisión. Revisa tu conexión e intenta de nuevo.',
  };
}

const MENSAJES_DE_PUBLICACION: Readonly<Record<string, string>> = {
  ROL_INSUFICIENTE: MENSAJES_DE_ERROR.ROL_INSUFICIENTE!,
  FUERA_DEL_AREA_DE_SERVICIO: 'Ese punto está fuera de La Paz y El Alto.',
};

/** Qué decir cuando falla la publicación de un incidente oficial (HU-13). */
export function mensajeDePublicacion(error: unknown): Mensaje {
  const codigo = codigoDe(error);
  return {
    tono: 'problema',
    texto:
      (codigo && MENSAJES_DE_PUBLICACION[codigo]) ??
      'No pudimos publicar el incidente. Revisa tu conexión e intenta de nuevo.',
  };
}
