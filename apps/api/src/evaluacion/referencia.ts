// La referencia independiente del análisis (ADR-007): a qué incidente real pertenece cada envío
// (etiquetado) y si ese incidente fue real y cuándo terminó (verificación). Nunca los votos de la
// plataforma.
import type { DatosDeEvaluacion, TransicionDato, VerificacionDato } from './datos.js';

export interface Incidente {
  /** `true` real, `false` falso, `null` sin verificar. Un incidente oficial es real. */
  readonly real: boolean | null;
  /** La primera hora de fin verificada, si se conoce. */
  readonly finEn: number | null;
}

export interface Referencia {
  /** Grupo final de cada envío: el del consenso; si no lo hay, el de A; si no, el de B. */
  readonly grupoDe: (idEnvio: string) => string | undefined;
  readonly incidente: (grupo: string) => Incidente | undefined;
  readonly verificacion: (idReporte: string) => VerificacionDato | undefined;
}

const PRIORIDAD = ['CONSENSO', 'A', 'B'];

function gruposFinales(datos: DatosDeEvaluacion): Map<string, string> {
  const grupos = new Map<string, string>();
  const ordenadas = datos.etiquetas.toSorted(
    (a, b) => PRIORIDAD.indexOf(b.evaluador) - PRIORIDAD.indexOf(a.evaluador),
  );
  // De menor a mayor prioridad: la última escritura gana.
  for (const e of ordenadas) grupos.set(e.idEnvio, e.grupo);
  return grupos;
}

function resumirIncidente(
  verificaciones: readonly VerificacionDato[],
  oficial: boolean,
): Incidente {
  const reales = verificaciones.filter((v) => v.resultado === 'REAL');
  const falsos = verificaciones.filter((v) => v.resultado === 'FALSO');
  const finales = reales.map((v) => v.finEn).filter((f): f is number => f !== null);
  let real: boolean | null = null;
  if (oficial || reales.length > 0) real = true;
  else if (falsos.length > 0) real = false;
  return { real, finEn: finales.length > 0 ? Math.min(...finales) : null };
}

/**
 * Arma la referencia. La veracidad de un incidente sale de las verificaciones de sus reportes (un
 * reporte es el envío que lo creó); con una sola verificación real, el incidente es real.
 */
export function construirReferencia(datos: DatosDeEvaluacion): Referencia {
  const grupos = gruposFinales(datos);
  const verificaciones = new Map(datos.verificaciones.map((v) => [v.idReporte, v]));
  const porGrupo = new Map<string, { verificaciones: VerificacionDato[]; oficial: boolean }>();
  for (const envio of datos.envios) {
    const grupo = grupos.get(envio.idEnvio);
    if (grupo === undefined) continue;
    const acumulado = porGrupo.get(grupo) ?? { verificaciones: [], oficial: false };
    const verificacion = verificaciones.get(envio.idEnvio);
    if (envio.tipo === 'CREADO' && verificacion) acumulado.verificaciones.push(verificacion);
    acumulado.oficial ||= envio.fuenteOficial !== null;
    porGrupo.set(grupo, acumulado);
  }
  const incidentes = new Map(
    [...porGrupo].map(([g, a]) => [g, resumirIncidente(a.verificaciones, a.oficial)]),
  );
  return {
    grupoDe: (idEnvio) => grupos.get(idEnvio),
    incidente: (grupo) => incidentes.get(grupo),
    verificacion: (idReporte) => verificaciones.get(idReporte),
  };
}

/** El incidente sigue siendo real en `t`: verificado real y sin fin anterior a `t`. */
export const vigenteYReal = (incidente: Incidente | undefined, t: number): boolean =>
  incidente?.real === true && (incidente.finEn === null || incidente.finEn > t);

export interface VidaDelReporte {
  readonly creadoEn: number;
  /** Primera vez que pasó a `CONFIRMADO`, si pasó. */
  readonly confirmadoEn: number | null;
  /**
   * Cuándo dejó de verse en el mapa: al cerrarse (resuelto, caducado o rechazado) o al vencer su
   * caducidad, lo que ocurra antes. El mapa no muestra un reporte vencido aunque no se haya
   * caducado todavía.
   */
  readonly finVisible: number;
}

/** El ciclo de vida de un reporte desde sus transiciones, en orden. */
export function vidaDelReporte(transiciones: readonly TransicionDato[]): VidaDelReporte | null {
  const ordenadas = transiciones.toSorted((a, b) => a.ocurridoEn - b.ocurridoEn);
  const primera = ordenadas[0];
  if (!primera) return null;
  const cierre = ordenadas.find((t) => t.caducaEn === null);
  const hastaCierre = ordenadas.filter((t) => !cierre || t.ocurridoEn <= cierre.ocurridoEn);
  const caducidad =
    hastaCierre.findLast((t) => t.caducaEn !== null)?.caducaEn ?? primera.ocurridoEn;
  return {
    creadoEn: primera.ocurridoEn,
    confirmadoEn: ordenadas.find((t) => t.estado === 'CONFIRMADO')?.ocurridoEn ?? null,
    finVisible: Math.min(cierre?.ocurridoEn ?? Number.POSITIVE_INFINITY, caducidad),
  };
}
