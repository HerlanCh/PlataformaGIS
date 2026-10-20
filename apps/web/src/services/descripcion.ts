// Descripción privada de un reporte propio (HU-10). Es un paso posterior y opcional: no se encola
// sin conexión, para que reportar siga siendo de dos toques.
import { esRechazo, JSON_CABECERA, pedirConToken, rechazoDe } from './peticion.js';
import type { Rechazo } from './peticion.js';

/** Caracteres máximos, contados como los cuenta la API (un emoji es uno). */
export const MAX_DESCRIPCION = 280;

export const largoDe = (texto: string): number => [...texto.trim()].length;

export type ResultadoDeDescripcion =
  { readonly tipo: 'GUARDADA' } | Rechazo | { readonly tipo: 'SIN_RED' };

export async function describirReporte(
  urlApi: string,
  idReporte: string,
  descripcion: string,
  pedir: typeof fetch = fetch,
): Promise<ResultadoDeDescripcion> {
  let respuesta: Response;
  try {
    respuesta = await pedirConToken(urlApi, pedir, `/v1/reportes/${idReporte}/descripcion`, {
      method: 'PATCH',
      headers: JSON_CABECERA,
      body: JSON.stringify({ descripcion: descripcion.trim() }),
    });
  } catch {
    return { tipo: 'SIN_RED' };
  }
  if (respuesta.ok) return { tipo: 'GUARDADA' };
  return esRechazo(respuesta) ? rechazoDe(respuesta) : { tipo: 'SIN_RED' };
}
