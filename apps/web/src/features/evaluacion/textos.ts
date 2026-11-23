import { ErrorDeEvaluacion } from '../../services/evaluacion.js';

/** Qué decir cuando la API rechaza una operación de evaluación, por su código. */
const MENSAJES: Readonly<Record<string, string>> = {
  ROL_INSUFICIENTE: 'Tu cuenta ya no tiene el rol de moderación.',
  NOMBRE_REPETIDO: 'Ya hay una instantánea con ese nombre.',
  INSTANTE_FUTURO: 'El instante no puede ser posterior a ahora.',
  FALTAN_INSTANTANEAS: 'Antes de las tareas hay que congelar las instantáneas E1 y E2.',
  PARTICIPANTE_REPETIDO: 'Ese código de participante ya tiene sesión.',
  TAREA_ANTERIOR_PENDIENTE: 'Primero hay que terminar la tarea 1.',
  TAREA_YA_INICIADA: 'Esa tarea ya empezó: no se puede repetir.',
  TAREA_YA_TERMINADA: 'Esa tarea ya terminó.',
  TAREA_NO_INICIADA: 'Esa tarea aún no empezó.',
  VALIDACION_FALLIDA: 'Revisa los datos: hay un campo inválido.',
};

/** Mensaje para el aviso de un error de evaluación. */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  const codigo = error instanceof ErrorDeEvaluacion ? error.rechazo?.codigo : undefined;
  return (codigo && MENSAJES[codigo]) ?? porDefecto;
}

const HORA = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** «22/11, 14:05», en la hora de Bolivia. */
export const horaCorta = (iso: string): string => HORA.format(new Date(iso));

/** Bolivia no tiene horario de verano: siempre UTC−4. */
const DESFASE_BOLIVIA = '-04:00';

/** Periodo de días de Bolivia (ambos incluidos) como instantes ISO `[desde, hasta)`. */
export function periodoDeDias(
  diaDesde: string,
  diaHasta: string,
): { desde: string; hasta: string } {
  const desde = new Date(`${diaDesde}T00:00:00${DESFASE_BOLIVIA}`);
  const hasta = new Date(`${diaHasta}T00:00:00${DESFASE_BOLIVIA}`);
  hasta.setUTCDate(hasta.getUTCDate() + 1);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

/** Hoy en Bolivia, como `AAAA-MM-DD`. */
export const hoyEnBolivia = (ahora = new Date()): string =>
  new Date(ahora.getTime() - 4 * 3_600_000).toISOString().slice(0, 10);

/** `AAAA-MM-DDTHH:mm` (hora local del dispositivo) para un `<input type="datetime-local">`. */
export function aLocal(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** «2:35» para la cuenta atrás. */
export function minutosYSegundos(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
