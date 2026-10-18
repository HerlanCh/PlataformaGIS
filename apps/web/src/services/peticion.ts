// Peticiones autenticadas a la API: llevan el token del dispositivo y, ante un 401 (token vencido o
// de una clave rotada), lo renuevan una vez. También traduce un rechazo 4xx a su código.
import { obtenerToken } from './sesion.js';

export interface Rechazo {
  readonly tipo: 'RECHAZADO';
  readonly codigo: string;
  /** Segundos que pide esperar la API (`Retry-After`), si los indica. */
  readonly reintentarEnS: number | null;
}

/** `fetch` con el token del dispositivo. Un fallo de red se propaga como excepción. */
export async function pedirConToken(
  urlApi: string,
  pedir: typeof fetch,
  ruta: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const enviar = async (forzar: boolean) => {
    const token = await obtenerToken(urlApi, { forzar, fetch: pedir });
    return pedir(`${urlApi}${ruta}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${token}` },
    });
  };
  const respuesta = await enviar(false);
  return respuesta.status === 401 ? enviar(true) : respuesta;
}

export const esRechazo = (respuesta: Response): boolean =>
  respuesta.status >= 400 && respuesta.status < 500;

/** Código del problema RFC 7807 y la espera indicada, de una respuesta 4xx. */
export async function rechazoDe(respuesta: Response): Promise<Rechazo> {
  const problema = (await respuesta.json().catch(() => ({}))) as { codigo?: string };
  const espera = Number(respuesta.headers.get('retry-after'));
  return {
    tipo: 'RECHAZADO',
    codigo: problema.codigo ?? `HTTP_${respuesta.status}`,
    reintentarEnS: Number.isFinite(espera) && espera > 0 ? espera : null,
  };
}

export const JSON_CABECERA = { 'content-type': 'application/json' };
