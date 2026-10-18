import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { URL_API } from '../../configuracion.js';
import type { Punto } from '../../domain/geo.js';
import { useEstado } from '../../estado.js';
import {
  encolar,
  enviarPendientes,
  ETIQUETA_DE_SINCRONIZACION,
  pendientes,
} from '../../services/cola.js';
import type { ResultadoDeEnvio } from '../../services/cola.js';
import { mensajeDeResultado, mensajeDeUbicacion } from './mensajes.js';

/** Posición actual del GPS, con un límite de espera para no colgar el reporte. */
export function leerPosicion(): Promise<Punto> {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) {
      rechazar(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ latitud: p.coords.latitude, longitud: p.coords.longitude }),
      rechazar,
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  });
}

/** Pide al service worker que envíe la cola cuando vuelva la señal, donde exista Background Sync. */
async function programarSincronizacion(): Promise<void> {
  const registro = await navigator.serviceWorker?.ready.catch(() => undefined);
  const sync = (registro as { sync?: { register(tag: string): Promise<void> } } | undefined)?.sync;
  await sync?.register(ETIQUETA_DE_SINCRONIZACION).catch(() => undefined);
}

/** Envía la cola y comunica el resultado del último reporte. */
export function useEnviarCola() {
  const consulta = useQueryClient();
  return useCallback(async (): Promise<ResultadoDeEnvio[]> => {
    const { avisar, fijarPendientes } = useEstado.getState();
    const resultados = await enviarPendientes(URL_API);
    fijarPendientes((await pendientes()).length);
    const ultimo = resultados.at(-1);
    if (ultimo) {
      const { tono, texto } = mensajeDeResultado(ultimo.resultado);
      avisar(tono, texto);
      if (ultimo.resultado.tipo === 'PENDIENTE') await programarSincronizacion();
    }
    if (resultados.some((r) => r.resultado.tipo !== 'PENDIENTE')) {
      await consulta.invalidateQueries({ queryKey: ['reportes'] });
    }
    return resultados;
  }, [consulta]);
}

/**
 * Reporte en dos toques (HU-01): el segundo toque, sobre la categoría, toma la posición del GPS,
 * guarda el reporte en la cola local y lo envía. Sin señal, queda pendiente (HU-05).
 */
export function useReportar() {
  const enviarCola = useEnviarCola();
  return useCallback(
    async (codigoCategoria: string): Promise<void> => {
      const { avisar, cerrarHoja, fijarPendientes, fijarPosicion } = useEstado.getState();
      cerrarHoja();
      let posicion: Punto;
      try {
        posicion = await leerPosicion();
      } catch (error) {
        const { tono, texto } = mensajeDeUbicacion(error as GeolocationPositionError | null);
        avisar(tono, texto);
        return;
      }
      fijarPosicion(posicion);
      await encolar({ codigoCategoria, ...posicion });
      fijarPendientes((await pendientes()).length);
      await enviarCola();
    },
    [enviarCola],
  );
}
