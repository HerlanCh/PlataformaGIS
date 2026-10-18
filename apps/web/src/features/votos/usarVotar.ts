import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { URL_API } from '../../configuracion.js';
import { useEstado } from '../../estado.js';
import { leerMemoria } from '../../services/memoria.js';
import type { Recuerdo } from '../../services/memoria.js';
import { votar } from '../../services/votos.js';
import type { ValorDeVoto } from '../../services/votos.js';
import { mensajeDeUbicacion } from '../reporte/mensajes.js';
import { leerPosicion } from '../reporte/usarReportar.js';
import { mensajeDeVoto } from './mensajes.js';

export const CLAVE_DE_MEMORIA = ['memoria'] as const;

const SIN_RECUERDOS: ReadonlyMap<string, Recuerdo> = new Map();

/** Lo que este dispositivo recuerda de cada reporte, o `null` mientras se lee. */
export function useMemoriaCargada(): ReadonlyMap<string, Recuerdo> | null {
  return useQuery({ queryKey: CLAVE_DE_MEMORIA, queryFn: leerMemoria }).data ?? null;
}

/** Lo que este dispositivo recuerda de cada reporte (propios, votados, preguntados). */
export function useMemoria(): ReadonlyMap<string, Recuerdo> {
  return useMemoriaCargada() ?? SIN_RECUERDOS;
}

/** Ni propio, ni votado: se le puede preguntar «¿Sigue ahí?». */
export const sePuedeVotar = (recuerdo: Recuerdo | undefined): boolean =>
  !recuerdo?.propio && !recuerdo?.voto;

/** Votar «Sigue ahí» o «Ya no está» con la posición del momento (HU-03). */
export function useVotar() {
  const consulta = useQueryClient();
  const [enCurso, setEnCurso] = useState(false);

  const enviar = useCallback(
    async (idReporte: string, valor: ValorDeVoto): Promise<boolean> => {
      const { avisar, fijarPosicion } = useEstado.getState();
      setEnCurso(true);
      try {
        let posicion;
        try {
          posicion = await leerPosicion();
        } catch (error) {
          const { tono, texto } = mensajeDeUbicacion(
            error as GeolocationPositionError | null,
            'votar',
          );
          avisar(tono, texto);
          return false;
        }
        fijarPosicion(posicion);
        const resultado = await votar(URL_API, idReporte, valor, posicion);
        await consulta.invalidateQueries({ queryKey: CLAVE_DE_MEMORIA });
        const { tono, texto } = mensajeDeVoto(resultado, valor);
        avisar(tono, texto);
        return resultado.tipo === 'REGISTRADO';
      } finally {
        setEnCurso(false);
      }
    },
    [consulta],
  );

  return { votar: enviar, enCurso };
}
