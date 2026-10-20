// Moderación (HU-12): la cola y las decisiones. Solo funciona en línea y con el rol MODERADOR,
// que llega con la credencial: la pantalla renueva el token al abrirse.
import type { CasoDeModeracion } from '@gis/api-client';
import { esRechazo, JSON_CABECERA, pedirConToken, rechazoDe } from './peticion.js';
import type { Rechazo } from './peticion.js';

export type { CasoDeModeracion };

export type Decision =
  { readonly tipo: 'RECHAZAR'; readonly motivo: string } | { readonly tipo: 'MANTENER' };

/** La API rechazó la operación, o no respondió (`rechazo` nulo). */
export class ErrorDeModeracion extends Error {
  constructor(readonly rechazo: Rechazo | null) {
    super(rechazo ? rechazo.codigo : 'No se pudo completar la operación');
  }
}

async function comprobar(respuesta: Response): Promise<Response> {
  if (respuesta.ok) return respuesta;
  throw new ErrorDeModeracion(esRechazo(respuesta) ? await rechazoDe(respuesta) : null);
}

export async function obtenerCola(
  urlApi: string,
  pedir: typeof fetch = fetch,
): Promise<CasoDeModeracion[]> {
  const respuesta = await comprobar(await pedirConToken(urlApi, pedir, '/v1/moderacion/cola'));
  return ((await respuesta.json()) as { casos: CasoDeModeracion[] }).casos;
}

export async function decidir(
  urlApi: string,
  idReporte: string,
  decision: Decision,
  pedir: typeof fetch = fetch,
): Promise<void> {
  const accion = decision.tipo === 'RECHAZAR' ? 'rechazar' : 'mantener';
  const cuerpo = decision.tipo === 'RECHAZAR' ? { motivo: decision.motivo.trim() } : {};
  await comprobar(
    await pedirConToken(urlApi, pedir, `/v1/moderacion/reportes/${idReporte}/${accion}`, {
      method: 'POST',
      headers: JSON_CABECERA,
      body: JSON.stringify(cuerpo),
    }),
  );
}
