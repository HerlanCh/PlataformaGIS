// Votos «¿Sigue ahí?» (HU-03). No se encolan sin conexión: dependen de dónde está la persona en
// ese momento, y la API exige estar a 1000 m o menos del incidente.
import type { Punto } from '../domain/geo.js';
import { recordar } from './memoria.js';
import { esRechazo, JSON_CABECERA, pedirConToken, rechazoDe } from './peticion.js';
import type { Rechazo } from './peticion.js';

export type ValorDeVoto = 'CONFIRMACION' | 'NEGACION';

/** Decisión de verificación que tomó la API tras el voto. */
export type Decision = 'NINGUNA' | 'CONFIRMAR' | 'EXTENDER' | 'RESOLVER';

export type ResultadoDeVoto =
  | { readonly tipo: 'REGISTRADO'; readonly decision: Decision }
  | Rechazo
  | { readonly tipo: 'SIN_RED' };

const RUTA: Record<ValorDeVoto, string> = { CONFIRMACION: 'confirmar', NEGACION: 'negar' };

/** Recuerda los rechazos que significan que este dispositivo ya no puede votar ese reporte. */
const RECUERDO_DE_RECHAZO: Record<string, Parameters<typeof recordar>[1]> = {
  YA_VOTO: { voto: 'CONFIRMACION' },
  AUTOR_NO_PUEDE_VOTAR: { propio: true },
};

export async function votar(
  urlApi: string,
  idReporte: string,
  valor: ValorDeVoto,
  posicion: Punto,
  pedir: typeof fetch = fetch,
): Promise<ResultadoDeVoto> {
  let respuesta: Response;
  try {
    respuesta = await pedirConToken(urlApi, pedir, `/v1/reportes/${idReporte}/${RUTA[valor]}`, {
      method: 'POST',
      headers: JSON_CABECERA,
      body: JSON.stringify(posicion),
    });
  } catch {
    return { tipo: 'SIN_RED' };
  }
  if (respuesta.ok) {
    const { decision } = (await respuesta.json()) as { decision: Decision };
    await recordar(idReporte, { voto: valor });
    return { tipo: 'REGISTRADO', decision };
  }
  if (!esRechazo(respuesta)) return { tipo: 'SIN_RED' };
  const rechazo = await rechazoDe(respuesta);
  const recuerdo = RECUERDO_DE_RECHAZO[rechazo.codigo];
  if (recuerdo) await recordar(idReporte, recuerdo);
  return rechazo;
}
