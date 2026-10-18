import type { CeldaDeCalor } from '@gis/api-client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { CATEGORIAS } from '../../domain/categorias.js';
import type { CodigoCategoria } from '../../domain/categorias.js';
import { aBbox } from '../../domain/geo.js';
import type { Caja } from '../../domain/geo.js';
import { useEstado } from '../../estado.js';
import { api } from '../../services/api.js';

export type { CeldaDeCalor };

const DIA_MS = 86_400_000;

/** La API no tiene el módulo de mapa de calor encendido. */
export class CalorNoDisponible extends Error {}

/** Las líneas visibles como parámetro `categorias`, o nada si se ven todas. */
export function categoriasVisibles(ocultas: readonly CodigoCategoria[]): string | undefined {
  if (ocultas.length === 0) return undefined;
  return CATEGORIAS.filter((c) => !ocultas.includes(c.codigo))
    .map((c) => c.codigo)
    .join(',');
}

async function pedirCalor(
  ventana: Caja,
  dias: number,
  categorias: string | undefined,
): Promise<readonly CeldaDeCalor[]> {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - dias * DIA_MS);
  const { data, response } = await api.GET('/v1/mapa-calor', {
    params: {
      query: {
        bbox: aBbox(ventana),
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        ...(categorias ? { categorias } : {}),
      },
    },
  });
  if (response.status === 404) throw new CalorNoDisponible();
  if (!data) throw new Error('No se pudo cargar el mapa de calor');
  return data.celdas;
}

/** Celdas con 3 o más reportes de la ventana (HU-06). Solo se pide con la capa activa. */
export function useMapaDeCalor() {
  const ventana = useEstado((s) => s.ventana);
  const activa = useEstado((s) => s.capa === 'calor');
  const dias = useEstado((s) => s.diasDeCalor);
  const categorias = useEstado((s) => categoriasVisibles(s.filtros.ocultas));
  // Sin líneas visibles no hay nada que pedir.
  const sinLineas = categorias === '';

  const consulta = useQuery({
    queryKey: ['calor', ventana, dias, categorias],
    queryFn: () => pedirCalor(ventana!, dias, categorias),
    enabled: activa && ventana !== null && !sinLineas,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: (intentos, error) => !(error instanceof CalorNoDisponible) && intentos < 2,
  });

  useEffect(() => {
    if (consulta.error instanceof CalorNoDisponible) useEstado.getState().marcarCalorNoDisponible();
  }, [consulta.error]);

  return { ...consulta, celdas: sinLineas ? [] : (consulta.data ?? null) };
}
