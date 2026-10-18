// Zonas suscritas (HU-07): listar, crear y eliminar las propias. Son operaciones en línea; sin
// conexión fallan con un error que la interfaz explica.
import type { Zona } from '@gis/api-client';
import { esRechazo, JSON_CABECERA, pedirConToken, rechazoDe } from './peticion.js';
import type { Rechazo } from './peticion.js';

export type { Zona };

export interface NuevaZona {
  readonly latitud: number;
  readonly longitud: number;
  readonly radioM: number;
  readonly categorias: readonly string[];
}

/** La API rechazó la operación (límite de zonas, radio inválido…). */
export class ErrorDeZona extends Error {
  constructor(readonly rechazo: Rechazo | null) {
    super(rechazo ? rechazo.codigo : 'No se pudo completar la operación');
  }
}

async function comprobar(respuesta: Response): Promise<Response> {
  if (respuesta.ok) return respuesta;
  throw new ErrorDeZona(esRechazo(respuesta) ? await rechazoDe(respuesta) : null);
}

export async function listarZonas(urlApi: string, pedir: typeof fetch = fetch): Promise<Zona[]> {
  const respuesta = await comprobar(await pedirConToken(urlApi, pedir, '/v1/suscripciones'));
  return ((await respuesta.json()) as { zonas: Zona[] }).zonas;
}

export async function crearZona(
  urlApi: string,
  zona: NuevaZona,
  pedir: typeof fetch = fetch,
): Promise<Zona> {
  const respuesta = await comprobar(
    await pedirConToken(urlApi, pedir, '/v1/suscripciones', {
      method: 'POST',
      headers: JSON_CABECERA,
      body: JSON.stringify(zona),
    }),
  );
  return (await respuesta.json()) as Zona;
}

export async function eliminarZona(
  urlApi: string,
  idZona: string,
  pedir: typeof fetch = fetch,
): Promise<void> {
  await comprobar(
    await pedirConToken(urlApi, pedir, `/v1/suscripciones/${idZona}`, { method: 'DELETE' }),
  );
}
