import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { URL_API } from '../../configuracion.js';
import { useEstado } from '../../estado.js';
import { decidir, obtenerCola, publicarOficial } from '../../services/moderacion.js';
import type { Decision, NuevoReporteOficial } from '../../services/moderacion.js';
import { idUsuarioActual, obtenerToken, rolActual } from '../../services/sesion.js';
import { mensajeDeDecision, mensajeDePublicacion } from './textos.js';

export interface Acceso {
  readonly esModerador: boolean;
  /** Para pedir el rol a la administración. */
  readonly idUsuario: string | null;
}

/**
 * Renueva el token al abrir la pantalla: el rol de moderador se asigna en el servidor y llega con
 * la credencial nueva (HU-12).
 */
export function useAcceso() {
  return useQuery({
    queryKey: ['moderacion', 'acceso'],
    queryFn: async (): Promise<Acceso> => {
      await obtenerToken(URL_API, { forzar: true });
      return {
        esModerador: (await rolActual()) === 'MODERADOR',
        idUsuario: await idUsuarioActual(),
      };
    },
    staleTime: Infinity,
  });
}

const CLAVE_COLA = ['moderacion', 'cola'] as const;

/** La cola de moderación (HU-10 y HU-12), solo si el dispositivo tiene el rol. */
export function useCola(habilitada: boolean) {
  return useQuery({
    queryKey: CLAVE_COLA,
    queryFn: () => obtenerCola(URL_API),
    enabled: habilitada,
  });
}

/** Rechazar o mantener un reporte; al terminar, la cola se vuelve a pedir. */
export function useDecidir() {
  const consulta = useQueryClient();
  return useMutation({
    mutationFn: ({ idReporte, decision }: { idReporte: string; decision: Decision }) =>
      decidir(URL_API, idReporte, decision),
    onSuccess: (_, { decision }) => {
      useEstado
        .getState()
        .avisar(
          'exito',
          decision.tipo === 'RECHAZAR'
            ? 'Reporte rechazado: sale del mapa en unos segundos.'
            : 'Reporte mantenido en el mapa.',
        );
    },
    onError: (error) => {
      const { tono, texto } = mensajeDeDecision(error);
      useEstado.getState().avisar(tono, texto);
    },
    onSettled: () => consulta.invalidateQueries({ queryKey: CLAVE_COLA }),
  });
}

/** Publicar un incidente de fuente oficial (HU-13). Devuelve `true` si se publicó. */
export function usePublicarOficial() {
  return useMutation({
    mutationFn: ({ incidente, clave }: { incidente: NuevoReporteOficial; clave: string }) =>
      publicarOficial(URL_API, incidente, clave),
    onSuccess: () => {
      useEstado.getState().avisar('exito', 'Incidente oficial publicado en el mapa.');
    },
    onError: (error) => {
      const { tono, texto } = mensajeDePublicacion(error);
      useEstado.getState().avisar(tono, texto);
    },
  });
}
