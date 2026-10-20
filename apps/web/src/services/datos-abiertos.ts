// Datos abiertos (HU-11): el resumen para los tableros y la descarga del CSV. Son públicos: no
// llevan el token del dispositivo.
import type { ResumenDatosAbiertos } from '@gis/api-client';

export type { ResumenDatosAbiertos };

export const urlDelCsv = (urlApi: string): string => `${urlApi}/v1/datos-abiertos.csv`;

export async function obtenerResumen(
  urlApi: string,
  pedir: typeof fetch = fetch,
): Promise<ResumenDatosAbiertos> {
  const respuesta = await pedir(`${urlApi}/v1/datos-abiertos/resumen`);
  if (!respuesta.ok) throw new Error(`No se pudo leer el resumen (${respuesta.status})`);
  return (await respuesta.json()) as ResumenDatosAbiertos;
}

/** Porcentaje entero, o `null` si no hay datos. */
export const porcentaje = (parte: number, total: number): number | null =>
  total === 0 ? null : Math.round((parte / total) * 100);
