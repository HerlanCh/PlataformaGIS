// Análisis de sensibilidad (ADR-007): el registro reprocesado con la malla de umbrales, radios y
// tiempos de vida, y los indicadores del registro (H1b a H1d) recalculados para cada combinación.
import { analizarRegistro } from './analisis.js';
import type { Indicador } from './analisis.js';
import type { DatosDeEvaluacion, VerificacionDato } from './datos.js';
import { simular } from './simulador.js';
import type { Categoria, Parametros } from './simulador.js';

export const UMBRALES = [2, 3, 4] as const;
export const FACTORES = [0.5, 1, 1.5] as const;

/** Las 27 combinaciones: umbral de confirmación × factor de radio × factor de tiempo de vida. */
export const MALLA: readonly Parametros[] = UMBRALES.flatMap((umbralDeConfirmacion) =>
  FACTORES.flatMap((factorDeRadio) =>
    FACTORES.map((factorDeTtl) => ({ umbralDeConfirmacion, factorDeRadio, factorDeTtl })),
  ),
);

export interface FilaDeSensibilidad extends Indicador {
  readonly umbral: number;
  readonly factor_radio: number;
  readonly factor_ttl: number;
}

/**
 * La verificación es de un reporte real (el envío que lo creó). En la simulación pasa al reporte
 * simulado que contiene ese envío; si contiene varios verificados, vale el del primer envío.
 */
function verificacionesSimuladas(
  verificaciones: readonly VerificacionDato[],
  envios: DatosDeEvaluacion['envios'],
): VerificacionDato[] {
  const porEnvio = new Map(verificaciones.map((v) => [v.idReporte, v]));
  const asignadas = new Map<string, VerificacionDato>();
  for (const envio of envios.toSorted((a, b) => a.recibidoEn - b.recibidoEn)) {
    const verificacion = porEnvio.get(envio.idEnvio);
    if (verificacion && !asignadas.has(envio.idReporte)) {
      asignadas.set(envio.idReporte, { ...verificacion, idReporte: envio.idReporte });
    }
  }
  return [...asignadas.values()];
}

/** Indicadores del registro con unos parámetros. */
export function indicadoresCon(
  datos: DatosDeEvaluacion,
  categorias: ReadonlyMap<string, Categoria>,
  parametros: Parametros,
): FilaDeSensibilidad[] {
  const simulacion = simular(datos, categorias, parametros);
  const simulados: DatosDeEvaluacion = {
    ...datos,
    envios: simulacion.envios,
    transiciones: simulacion.transiciones,
    verificaciones: verificacionesSimuladas(datos.verificaciones, simulacion.envios),
  };
  const ttl = new Map([...categorias].map(([c, v]) => [c, v.ttlMinutos * parametros.factorDeTtl]));
  return analizarRegistro(simulados, ttl).indicadores.map((i) => ({
    ...i,
    umbral: parametros.umbralDeConfirmacion,
    factor_radio: parametros.factorDeRadio,
    factor_ttl: parametros.factorDeTtl,
  }));
}

/** La malla completa: una fila por combinación e indicador. */
export const sensibilidad = (
  datos: DatosDeEvaluacion,
  categorias: ReadonlyMap<string, Categoria>,
): FilaDeSensibilidad[] => MALLA.flatMap((p) => indicadoresCon(datos, categorias, p));
