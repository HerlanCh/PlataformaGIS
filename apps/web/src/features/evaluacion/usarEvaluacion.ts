import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { URL_API } from '../../configuracion.js';
import { useEstado } from '../../estado.js';
import { clienteDeEvaluacion } from '../../services/evaluacion.js';
import type { ClienteDeEvaluacion } from '../../services/evaluacion.js';
import { mensajeDeError } from './textos.js';

/** `fetch` se toma al pedir, no al crear el cliente: así lo pueden reemplazar las pruebas. */
const cliente = clienteDeEvaluacion(URL_API, (entrada, init) => fetch(entrada, init));

export const usarCliente = (): ClienteDeEvaluacion => cliente;

export const CLAVES = {
  instantaneas: ['evaluacion', 'instantaneas'],
  sesiones: ['evaluacion', 'sesiones'],
  verificaciones: ['evaluacion', 'verificaciones'],
} as const satisfies Record<string, QueryKey>;

export function useInstantaneas() {
  const api = usarCliente();
  return useQuery({ queryKey: CLAVES.instantaneas, queryFn: () => api.instantaneas() });
}

export function useSesiones() {
  const api = usarCliente();
  return useQuery({ queryKey: CLAVES.sesiones, queryFn: () => api.sesiones() });
}

/**
 * Una operación que cambia algo: avisa el éxito o el error y, al terminar, vuelve a pedir lo que
 * pudo cambiar.
 */
export function useOperacion<E, S>(
  operacion: (api: ClienteDeEvaluacion, entrada: E) => Promise<S>,
  mensajes: { readonly exito?: string; readonly error: string },
  invalidar: readonly QueryKey[] = [],
) {
  const api = usarCliente();
  const consulta = useQueryClient();
  return useMutation({
    mutationFn: (entrada: E) => operacion(api, entrada),
    onSuccess: () => {
      if (mensajes.exito) useEstado.getState().avisar('exito', mensajes.exito);
    },
    onError: (error) =>
      useEstado.getState().avisar('problema', mensajeDeError(error, mensajes.error)),
    onSettled: () =>
      Promise.all(invalidar.map((queryKey) => consulta.invalidateQueries({ queryKey }))),
  });
}
