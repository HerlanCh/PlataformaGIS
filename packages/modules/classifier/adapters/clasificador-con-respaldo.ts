import type { Clasificacion, Clasificador, DatosParaClasificar } from '../domain/clasificacion.js';

export interface OpcionesDeRespaldo {
  /** Espera máxima por el clasificador principal. */
  readonly tiempoLimiteMs: number;
  /** Se llama cuando el principal falla o tarda, antes de usar el respaldo. */
  readonly alFallar?: (error: unknown) => void;
}

/**
 * Usa el clasificador principal (el modelo de IA de la Fase 13) y, si falla o tarda más que el
 * límite, el de respaldo (las reglas). Así un servicio caído nunca deja un reporte sin clasificar
 * (HU-10, escenario 2).
 */
export class ClasificadorConRespaldo implements Clasificador {
  constructor(
    private readonly principal: Clasificador,
    private readonly respaldo: Clasificador,
    private readonly opciones: OpcionesDeRespaldo,
  ) {}

  async clasificar(datos: DatosParaClasificar): Promise<Clasificacion> {
    let temporizador: NodeJS.Timeout | undefined;
    const limite = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(
        () =>
          rechazar(new Error(`El clasificador tardó más de ${this.opciones.tiempoLimiteMs} ms`)),
        this.opciones.tiempoLimiteMs,
      );
    });
    try {
      return await Promise.race([this.principal.clasificar(datos), limite]);
    } catch (error) {
      this.opciones.alFallar?.(error);
      return this.respaldo.clasificar(datos);
    } finally {
      clearTimeout(temporizador);
    }
  }
}
