import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { URL_API } from '../../configuracion.js';
import { useEstado } from '../../estado.js';
import { crearZona, eliminarZona, ErrorDeZona, listarZonas } from '../../services/zonas.js';
import type { NuevaZona, Zona } from '../../services/zonas.js';
import type { Mensaje } from '../reporte/mensajes.js';

export type { Zona };

/** Zonas suscritas por usuario (SRS 3.3). */
export const MAX_ZONAS = 5;
export const RADIO_MINIMO_M = 100;
export const RADIO_MAXIMO_M = 2000;

const CLAVE = ['zonas'] as const;

const MENSAJES: Record<string, string> = {
  LIMITE_DE_ZONAS: `Ya tienes ${MAX_ZONAS} zonas. Elimina una para crear otra.`,
  RADIO_INVALIDO: `El radio debe estar entre ${RADIO_MINIMO_M} m y ${RADIO_MAXIMO_M} m.`,
  SIN_CATEGORIAS: 'Elige al menos una línea para tu zona.',
  FUERA_DEL_AREA_DE_SERVICIO: 'Por ahora las zonas funcionan solo en La Paz y El Alto.',
  ZONA_NO_ENCONTRADA: 'Esa zona ya no existía.',
};

/** Qué decir cuando falla una operación con zonas. */
export function mensajeDeZona(error: unknown): Mensaje {
  const codigo = error instanceof ErrorDeZona ? error.rechazo?.codigo : undefined;
  const texto = codigo ? MENSAJES[codigo] : undefined;
  return {
    tono: 'problema',
    texto: texto ?? 'No pudimos guardar el cambio. Revisa tu conexión e intenta de nuevo.',
  };
}

/** La API no tiene el módulo de suscripciones encendido. */
export const zonasNoDisponibles = (error: unknown): boolean =>
  error instanceof ErrorDeZona && error.rechazo?.codigo === 'HTTP_404';

/** Zonas propias (HU-07), con las operaciones para crear y eliminar. */
export function useZonas() {
  const consulta = useQueryClient();
  const lista = useQuery({
    queryKey: CLAVE,
    queryFn: () => listarZonas(URL_API),
    staleTime: 5 * 60_000,
    retry: (intentos, error) => !zonasNoDisponibles(error) && intentos < 2,
  });
  const alFallar = (error: unknown) => {
    const { tono, texto } = mensajeDeZona(error);
    useEstado.getState().avisar(tono, texto);
  };
  const refrescar = () => consulta.invalidateQueries({ queryKey: CLAVE });

  const crear = useMutation({
    mutationFn: (zona: NuevaZona) => crearZona(URL_API, zona),
    onSuccess: async () => {
      await refrescar();
      const estado = useEstado.getState();
      estado.terminarZona();
      estado.avisar('exito', 'Zona guardada.');
      estado.abrirZonas();
    },
    onError: alFallar,
  });

  const eliminar = useMutation({
    mutationFn: (idZona: string) => eliminarZona(URL_API, idZona),
    onSuccess: async () => {
      await refrescar();
      useEstado.getState().avisar('exito', 'Zona eliminada.');
    },
    onError: alFallar,
  });

  return { lista, crear, eliminar };
}
