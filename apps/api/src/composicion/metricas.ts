// Métricas de uso del piloto (Fase 13). Quién reporta o vota se cuenta aquí, en la raíz de
// composición: los casos de uso de `reports` y `verification` no saben que `metrics` existe.
import { ConsultarMetricas, RegistrarActividad, RepositorioMetricasPg } from '@gis/module-metrics';
import type { Db } from '@gis/platform';
import type { Reloj } from '@gis/shared-kernel';

/** Registra la actividad de un usuario. Nunca falla: las métricas no impiden reportar ni votar. */
export type AnotarActividad = (idUsuario: string) => Promise<void>;

/**
 * Envuelve un caso de uso para anotar a quien lo ejecutó con éxito. Si la ejecución falla, no
 * cuenta como actividad.
 */
export function conActividad<E, S>(
  caso: { ejecutar(entrada: E): Promise<S> },
  idDe: (entrada: E) => string,
  anotar: AnotarActividad,
): { ejecutar(entrada: E): Promise<S> } {
  return {
    async ejecutar(entrada) {
      const salida = await caso.ejecutar(entrada);
      await anotar(idDe(entrada));
      return salida;
    },
  };
}

export interface Metricas {
  readonly consultar: ConsultarMetricas;
  readonly anotar: AnotarActividad;
}

/** El usuario de humo (roadmap 12) no cuenta como activo. */
export function componerMetricas(
  db: Db,
  reloj: Reloj,
  sal: string,
  idUsuarioDeHumo: string | null,
): Metricas {
  const repositorio = new RepositorioMetricasPg(db);
  const actividad = new RegistrarActividad(repositorio, reloj, sal);
  return {
    consultar: new ConsultarMetricas(repositorio),
    async anotar(idUsuario) {
      if (idUsuario === idUsuarioDeHumo) return;
      try {
        await actividad.ejecutar(idUsuario);
      } catch {
        // Perder un conteo es preferible a rechazar un reporte ya guardado.
      }
    },
  };
}
