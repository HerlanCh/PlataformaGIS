import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { URL_API } from '../../configuracion.js';
import { aBbox } from '../../domain/geo.js';
import type { Caja } from '../../domain/geo.js';
import { aplicarEvento } from '../../domain/reportes.js';
import type { EventoPublico, ReportePublico } from '../../domain/reportes.js';
import { useEstado } from '../../estado.js';
import { api } from '../../services/api.js';
import { obtenerToken } from '../../services/sesion.js';
import { ConexionTiempoReal } from '../../services/tiempo-real.js';

export const claveDeReportes = (ventana: Caja) => ['reportes', ventana] as const;

async function pedirReportes(ventana: Caja): Promise<readonly ReportePublico[]> {
  const { data, error } = await api.GET('/v1/reportes', {
    params: { query: { bbox: aBbox(ventana) } },
  });
  if (error || !data) throw new Error('No se pudieron cargar los reportes');
  return data.reportes;
}

/** Reportes vigentes de la ventana del mapa (HU-02), con la ventana anterior mientras carga. */
export function useReportesEnVentana() {
  const ventana = useEstado((s) => s.ventana);
  return useQuery({
    queryKey: ventana ? claveDeReportes(ventana) : ['reportes', 'sin-ventana'],
    queryFn: () => pedirReportes(ventana!),
    enabled: ventana !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** Aplica un evento a cada ventana en caché. Se exporta para probarla sin socket. */
export function fusionarEvento(consulta: QueryClient, evento: EventoPublico): void {
  for (const [clave, lista] of consulta.getQueriesData<readonly ReportePublico[]>({
    queryKey: ['reportes'],
  })) {
    const ventana = clave[1];
    if (!lista || typeof ventana !== 'object' || ventana === null) continue;
    const nueva = aplicarEvento(lista, evento, ventana as Caja);
    if (nueva !== lista) consulta.setQueryData(clave, nueva);
  }
}

/** Mantiene la conexión de tiempo real mientras la app está abierta (HU-02, escenario 2). */
export function useTiempoReal(): void {
  const consulta = useQueryClient();
  const ventana = useEstado((s) => s.ventana);
  const conexionRef = useRef<ConexionTiempoReal | null>(null);

  useEffect(() => {
    const vistos = new Set<string>();
    const conexion = new ConexionTiempoReal(URL_API, (o) => obtenerToken(URL_API, o), {
      alEvento: (evento) => {
        // La entrega es "al menos una vez": cada evento trae su id para descartar repetidos.
        if (vistos.has(evento.id)) return;
        vistos.add(evento.id);
        fusionarEvento(consulta, evento);
      },
      alEstado: (estado) => useEstado.getState().fijarConexion(estado),
      alPerderEventos: () => void consulta.invalidateQueries({ queryKey: ['reportes'] }),
    });
    conexion.conectar();
    conexionRef.current = conexion;
    return () => {
      conexionRef.current = null;
      conexion.cerrar();
    };
  }, [consulta]);

  useEffect(() => {
    if (ventana) conexionRef.current?.actualizarVentana(aBbox(ventana));
  }, [ventana]);
}
