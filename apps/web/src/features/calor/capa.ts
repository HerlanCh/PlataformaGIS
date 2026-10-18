// Capa de mapa de calor con `leaflet.heat`. Se carga solo al activarla, para no sumar al JS inicial.
import L from 'leaflet';
import type { CeldaDeCalor } from '@gis/api-client';

/**
 * Escala de tinta: el calor no usa colores de línea, que ya significan una categoría. Va de la
 * plateada a la tinta de señal sobre el mapa en grises.
 */
export const GRADIENTE_DE_CALOR = {
  0.25: '#d6dbe1',
  0.5: '#8a939c',
  0.75: '#4a525c',
  1: '#14181d',
} as const;

/**
 * Puntos `[lat, lon, intensidad]`. La intensidad es el puesto de la celda entre todas (percentil):
 * así se distinguen las zonas más reportadas aunque los recuentos sean parecidos.
 */
export function puntosDeCalor(celdas: readonly CeldaDeCalor[]): L.HeatLatLngTuple[] {
  if (celdas.length === 0) return [];
  const ordenadas = [...celdas].map((c) => c.cantidad).sort((a, b) => a - b);
  const puesto = (cantidad: number) => (ordenadas.lastIndexOf(cantidad) + 1) / ordenadas.length;
  return celdas.map((c) => [c.latitud, c.longitud, puesto(c.cantidad) ** 2]);
}

export async function crearCapaDeCalor(): Promise<L.HeatLayer> {
  // `leaflet.heat` es un script UMD que se cuelga del `L` global.
  (globalThis as { L?: typeof L }).L ??= L;
  await import('leaflet.heat');
  return L.heatLayer([], {
    radius: 28,
    blur: 22,
    // Sin atenuar por zoom: cada celda ya es un recuento del servidor.
    maxZoom: 11,
    max: 1,
    minOpacity: 0,
    gradient: GRADIENTE_DE_CALOR,
  });
}
