import { ErrorDeDominio } from './domain-error.js';
import type { PuntoGeo } from './geo-point.js';

/** Rectángulo en WGS84. */
export interface CajaGeografica {
  readonly latitudMin: number;
  readonly latitudMax: number;
  readonly longitudMin: number;
  readonly longitudMax: number;
}

/** Con precisión 6 una celda mide unos 1,2 km por 0,6 km: un barrio. */
export const PRECISION_CELDA = 6;

/** Tope de celdas por consulta: protege a la API de un área visible desmedida. */
export const MAX_CELDAS = 2500;

const PRECISION_MAXIMA = 12;
const ALFABETO = '0123456789bcdefghjkmnpqrstuvwxyz';

export class ErrorAreaDemasiadoGrande extends ErrorDeDominio {
  constructor(celdas: number, maximo: number) {
    super(
      'AREA_DEMASIADO_GRANDE',
      `El área necesita ${celdas} celdas y el máximo es ${maximo}; acerca el mapa o baja la precisión`,
    );
  }
}

function validarPrecision(precision: number): void {
  if (!Number.isInteger(precision) || precision < 1 || precision > PRECISION_MAXIMA) {
    throw new RangeError(`La precisión debe ser un entero entre 1 y ${PRECISION_MAXIMA}`);
  }
}

interface Intervalo {
  min: number;
  max: number;
}

const BITS_POR_CARACTER = 5;
const mundo = (): { latitud: Intervalo; longitud: Intervalo } => ({
  latitud: { min: -90, max: 90 },
  longitud: { min: -180, max: 180 },
});

/** Parte el intervalo por la mitad y se queda con la mitad alta o con la baja. */
function biseccionar(intervalo: Intervalo, mitadAlta: boolean): void {
  const mitad = (intervalo.min + intervalo.max) / 2;
  if (mitadAlta) intervalo.min = mitad;
  else intervalo.max = mitad;
}

/**
 * Geohash de cualquier coordenada WGS84, sin restringir el área de servicio.
 * Se bisecciona alternando longitud y latitud (empieza por la longitud); cada 5 bits son un
 * carácter del alfabeto base 32.
 */
export function codificarGeohash(latitud: number, longitud: number, precision: number): string {
  validarPrecision(precision);
  const { latitud: rangoLatitud, longitud: rangoLongitud } = mundo();
  let indice = 0;
  let resultado = '';

  for (let bit = 0; bit < precision * BITS_POR_CARACTER; bit += 1) {
    // Los bits pares afinan la longitud y los impares, la latitud.
    const esLongitud = bit % 2 === 0;
    const intervalo = esLongitud ? rangoLongitud : rangoLatitud;
    const valor = esLongitud ? longitud : latitud;
    const mitadAlta = valor >= (intervalo.min + intervalo.max) / 2;
    biseccionar(intervalo, mitadAlta);
    indice = (indice << 1) | (mitadAlta ? 1 : 0);

    if (bit % BITS_POR_CARACTER === BITS_POR_CARACTER - 1) {
      resultado += ALFABETO[indice];
      indice = 0;
    }
  }
  return resultado;
}

/** Celda geohash que contiene al punto. Sirve para agrupar clientes de WebSocket por zona. */
export const celdaDe = (punto: PuntoGeo, precision = PRECISION_CELDA): string =>
  codificarGeohash(punto.latitud, punto.longitud, precision);

/** Rectángulo exacto que ocupa una celda. */
export function limitesDeCelda(celda: string): CajaGeografica {
  if (celda.length === 0 || celda.length > PRECISION_MAXIMA) {
    throw new RangeError(`La celda debe tener entre 1 y ${PRECISION_MAXIMA} caracteres`);
  }
  const { latitud, longitud } = mundo();
  let bit = 0;

  for (const caracter of celda) {
    const valor = ALFABETO.indexOf(caracter);
    if (valor < 0) throw new RangeError(`"${caracter}" no es un carácter de geohash`);
    for (let posicion = BITS_POR_CARACTER - 1; posicion >= 0; posicion -= 1) {
      biseccionar(bit % 2 === 0 ? longitud : latitud, ((valor >> posicion) & 1) === 1);
      bit += 1;
    }
  }
  return {
    latitudMin: latitud.min,
    latitudMax: latitud.max,
    longitudMin: longitud.min,
    longitudMax: longitud.max,
  };
}

/**
 * Celdas que cubren una caja: las que contienen alguna de sus partes, sin repetir.
 * @throws {RangeError} si la caja está invertida.
 * @throws {ErrorAreaDemasiadoGrande} si hacen falta más de `MAX_CELDAS` celdas.
 */
export function celdasQueCubren(caja: CajaGeografica, precision = PRECISION_CELDA): string[] {
  validarPrecision(precision);
  if (caja.latitudMin > caja.latitudMax || caja.longitudMin > caja.longitudMax) {
    throw new RangeError('La caja está invertida: el mínimo supera al máximo');
  }

  const alto = limitesDeCelda(codificarGeohash(caja.latitudMin, caja.longitudMin, precision));
  const pasoLatitud = alto.latitudMax - alto.latitudMin;
  const pasoLongitud = alto.longitudMax - alto.longitudMin;
  const filas = Math.floor((caja.latitudMax - alto.latitudMin) / pasoLatitud) + 1;
  const columnas = Math.floor((caja.longitudMax - alto.longitudMin) / pasoLongitud) + 1;
  if (filas * columnas > MAX_CELDAS)
    throw new ErrorAreaDemasiadoGrande(filas * columnas, MAX_CELDAS);

  const celdas = new Set<string>();
  for (let fila = 0; fila < filas; fila += 1) {
    // Se muestrea el centro de cada celda de la cuadrícula; el borde exterior se acota a la caja.
    const latitud = Math.min(alto.latitudMin + (fila + 0.5) * pasoLatitud, caja.latitudMax);
    for (let columna = 0; columna < columnas; columna += 1) {
      const longitud = Math.min(
        alto.longitudMin + (columna + 0.5) * pasoLongitud,
        caja.longitudMax,
      );
      celdas.add(codificarGeohash(latitud, longitud, precision));
    }
  }
  return [...celdas];
}
