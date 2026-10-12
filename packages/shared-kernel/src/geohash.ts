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

/**
 * Geohash de cualquier coordenada WGS84, sin restringir el área de servicio.
 * Se bisecciona alternando longitud y latitud (empieza por la longitud); cada 5 bits son un
 * carácter del alfabeto base 32.
 */
export function codificarGeohash(latitud: number, longitud: number, precision: number): string {
  validarPrecision(precision);
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let esLongitud = true;
  let bits = 0;
  let indice = 0;
  let resultado = '';

  while (resultado.length < precision) {
    const mitad = esLongitud ? (lonMin + lonMax) / 2 : (latMin + latMax) / 2;
    const valor = esLongitud ? longitud : latitud;
    indice <<= 1;
    if (valor >= mitad) {
      indice |= 1;
      if (esLongitud) lonMin = mitad;
      else latMin = mitad;
    } else if (esLongitud) lonMax = mitad;
    else latMax = mitad;

    esLongitud = !esLongitud;
    bits += 1;
    if (bits === 5) {
      resultado += ALFABETO[indice];
      bits = 0;
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
  let [latMin, latMax] = [-90, 90];
  let [lonMin, lonMax] = [-180, 180];
  let esLongitud = true;

  for (const caracter of celda) {
    const valor = ALFABETO.indexOf(caracter);
    if (valor < 0) throw new RangeError(`"${caracter}" no es un carácter de geohash`);
    for (let bit = 4; bit >= 0; bit -= 1) {
      const encendido = ((valor >> bit) & 1) === 1;
      if (esLongitud) {
        const mitad = (lonMin + lonMax) / 2;
        if (encendido) lonMin = mitad;
        else lonMax = mitad;
      } else {
        const mitad = (latMin + latMax) / 2;
        if (encendido) latMin = mitad;
        else latMax = mitad;
      }
      esLongitud = !esLongitud;
    }
  }
  return { latitudMin: latMin, latitudMax: latMax, longitudMin: lonMin, longitudMax: lonMax };
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
