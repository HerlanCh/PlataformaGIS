import type { DatosParaClasificar, MotivoDeSospecha } from './clasificacion.js';

/** Puntaje desde el que un reporte va a la cola de moderación. */
export const UMBRAL_DE_SOSPECHA = 0.5;

/** Reportes del mismo autor en una hora a partir de los que se sospecha de él. */
export const UMBRAL_DE_FRECUENCIA = 4;

/**
 * Peso de cada indicio. Los fuertes (un enlace, publicidad, datos de una persona, muchos reportes
 * seguidos) bastan por sí solos; los débiles solo suman.
 */
export const PESOS: Readonly<Record<MotivoDeSospecha, number>> = {
  ENLACE: 0.6,
  SPAM: 0.5,
  DATOS_PERSONALES: 0.6,
  FRECUENCIA_DEL_AUTOR: 0.5,
  TEXTO_REPETITIVO: 0.3,
  LONGITUD_ANORMAL: 0.2,
};

/** Palabras de publicidad o estafa, sin tildes y en minúsculas. */
export const PALABRAS_DE_SPAM: readonly string[] = [
  'bitcoin',
  'casino',
  'click',
  'compra',
  'compre',
  'cripto',
  'descuento',
  'gana',
  'ganar',
  'gratis',
  'inversion',
  'oferta',
  'prestamo',
  'promo',
  'promocion',
  'premio',
  'sorteo',
  'suscribete',
  'vendo',
  'whatsapp',
];

const ENLACE =
  /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|bo|info|xyz|ly|io|me|link)\b/i;

// Datos que identifican a una persona: celular boliviano (8 dígitos que empiezan en 6 o 7, con o
// sin +591), correo, número de carné y placa de vehículo (3 o 4 dígitos y 3 letras).
// La placa excluye unidades que se escriben igual: «500 mts», «120 kms».
const DATOS_PERSONALES: readonly RegExp[] = [
  /(?:\+?591[\s-]?|\b)[67]\d{7}\b/,
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/,
  /\b(?:c\.?\s?i\.?|carnet|carne)\s*(?:n[°ºo]?\.?\s*)?:?\s*\d{5,}/i,
  /\b\d{3,4}[\s-]?(?!(?:mts|kms|cms|hrs|min|seg)\b)[a-z]{3}\b/i,
];

/** Un mismo carácter seis veces seguidas: «aaaaaa», «!!!!!!». */
const CARACTER_REPETIDO = /(.)\1{5,}/u;

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const palabrasDe = (texto: string): string[] => normalizar(texto).match(/\p{L}+/gu) ?? [];

function esRepetitivo(texto: string): boolean {
  if (CARACTER_REPETIDO.test(texto)) return true;
  const palabras = palabrasDe(texto);
  // Con 8 palabras o más, menos de un tercio distintas: «bloqueo bloqueo bloqueo…».
  return palabras.length >= 8 && new Set(palabras).size / palabras.length < 1 / 3;
}

function esDeLongitudAnormal(texto: string): boolean {
  const sinEspacios = texto.replace(/\s/g, '');
  // Muy corto para decir algo, o una tira de más de 40 caracteres sin espacios.
  return [...sinEspacios].length < 4 || texto.split(/\s+/).some((t) => [...t].length > 40);
}

function motivosDelTexto(texto: string): MotivoDeSospecha[] {
  const motivos: MotivoDeSospecha[] = [];
  if (ENLACE.test(texto)) motivos.push('ENLACE');
  if (palabrasDe(texto).some((p) => PALABRAS_DE_SPAM.includes(p))) motivos.push('SPAM');
  if (DATOS_PERSONALES.some((patron) => patron.test(texto))) motivos.push('DATOS_PERSONALES');
  if (esRepetitivo(texto)) motivos.push('TEXTO_REPETITIVO');
  if (esDeLongitudAnormal(texto)) motivos.push('LONGITUD_ANORMAL');
  return motivos;
}

export interface ResultadoDeReglas {
  readonly sospechoso: boolean;
  readonly motivos: readonly MotivoDeSospecha[];
  readonly puntaje: number;
}

/**
 * Clasificación por reglas (HU-10): suma el peso de cada indicio, hasta 1, y marca el reporte si
 * llega a `UMBRAL_DE_SOSPECHA`. Es determinista y explicable: los motivos dicen qué regla saltó.
 */
export function clasificarPorReglas(datos: DatosParaClasificar): ResultadoDeReglas {
  const motivos = datos.descripcion === null ? [] : motivosDelTexto(datos.descripcion);
  if (datos.reportesRecientesDelAutor >= UMBRAL_DE_FRECUENCIA) motivos.push('FRECUENCIA_DEL_AUTOR');
  const suma = motivos.reduce((total, motivo) => total + PESOS[motivo], 0);
  const puntaje = Math.min(1, Math.round(suma * 100) / 100);
  return { sospechoso: puntaje >= UMBRAL_DE_SOSPECHA, motivos, puntaje };
}
