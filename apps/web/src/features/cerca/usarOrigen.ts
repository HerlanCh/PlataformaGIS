import { CENTRO_LA_PAZ } from '../../domain/geo.js';
import type { Punto } from '../../domain/geo.js';
import { useEstado } from '../../estado.js';

/** Desde dónde se miden las distancias: el GPS o, sin él, el centro del mapa. */
export function useOrigen(): { readonly desde: Punto; readonly conGps: boolean } {
  const posicion = useEstado((s) => s.posicion);
  const ventana = useEstado((s) => s.ventana);
  if (posicion) return { desde: posicion, conGps: true };
  if (!ventana) return { desde: CENTRO_LA_PAZ, conGps: false };
  return {
    desde: {
      latitud: (ventana.latitudMin + ventana.latitudMax) / 2,
      longitud: (ventana.longitudMin + ventana.longitudMax) / 2,
    },
    conGps: false,
  };
}
