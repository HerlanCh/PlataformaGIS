import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reporteParaPreguntar } from '../../domain/cercania.js';
import type { ReportePublico } from '../../domain/reportes.js';
import { useEstado } from '../../estado.js';
import { recordar } from '../../services/memoria.js';
import { CLAVE_DE_MEMORIA, useMemoriaCargada } from './usarVotar.js';

/** El permiso de ubicación ya está concedido: se puede seguir la posición sin pedir nada. */
async function permisoConcedido(): Promise<PermissionStatus | null> {
  try {
    const estado = await navigator.permissions?.query({ name: 'geolocation' });
    return estado ?? null;
  } catch {
    return null;
  }
}

/**
 * Sigue la posición mientras la app está visible, solo si la persona ya dio permiso de ubicación.
 * Nunca muestra el diálogo del permiso por su cuenta.
 */
export function useSeguirPosicion(): void {
  useEffect(() => {
    let vigilancia: number | null = null;
    let permiso: PermissionStatus | null = null;
    let activo = true;

    const detener = () => {
      if (vigilancia !== null) navigator.geolocation.clearWatch(vigilancia);
      vigilancia = null;
    };
    const ajustar = () => {
      const debeSeguir = permiso?.state === 'granted' && document.visibilityState === 'visible';
      if (!debeSeguir) return detener();
      vigilancia ??= navigator.geolocation.watchPosition(
        (p) =>
          useEstado.getState().fijarPosicion({
            latitud: p.coords.latitude,
            longitud: p.coords.longitude,
          }),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 15_000 },
      );
    };

    void permisoConcedido().then((estado) => {
      if (!activo || !estado || !('geolocation' in navigator)) return;
      permiso = estado;
      permiso.addEventListener('change', ajustar);
      ajustar();
    });
    document.addEventListener('visibilitychange', ajustar);
    return () => {
      activo = false;
      detener();
      permiso?.removeEventListener('change', ajustar);
      document.removeEventListener('visibilitychange', ajustar);
    };
  }, []);
}

/**
 * «¿Sigue ahí?» automático (HU-03): el reporte vigente más cercano, a menos de 150 m, que no es
 * propio, no se votó y no se preguntó antes. Cada reporte se pregunta una sola vez.
 */
export function useSigueAhi(reportes: readonly ReportePublico[]) {
  const consulta = useQueryClient();
  const posicion = useEstado((s) => s.posicion);
  const editandoZona = useEstado((s) => s.zonaEnEdicion !== null);
  const memoria = useMemoriaCargada();
  const [actual, setActual] = useState<string | null>(null);
  // Lo preguntado en esta sesión, mientras la memoria de IndexedDB se vuelve a leer.
  const preguntados = useRef(new Set<string>());

  const candidato = useMemo(() => {
    // Sin la memoria leída no se sabe qué ya se preguntó.
    if (!posicion || editandoZona || !memoria) return null;
    const excluidos = new Set(
      [...memoria.values()]
        .filter((r) => r.propio || r.voto || r.preguntado)
        .map((r) => r.idReporte),
    );
    return reporteParaPreguntar(reportes, posicion, excluidos);
  }, [reportes, posicion, memoria, editandoZona]);

  useEffect(() => {
    if (actual || !candidato || preguntados.current.has(candidato.id)) return;
    preguntados.current.add(candidato.id);
    setActual(candidato.id);
    void recordar(candidato.id, { preguntado: true });
  }, [actual, candidato]);

  const descartar = useCallback(() => {
    setActual(null);
    void consulta.invalidateQueries({ queryKey: CLAVE_DE_MEMORIA });
  }, [consulta]);

  const reporte = reportes.find((r) => r.id === actual) ?? null;
  return { reporte, descartar };
}
