import { PuntoGeo } from '@gis/shared-kernel';
import type { UbicacionPublica } from './registro.js';

/**
 * Etiquetado (ADR-007): dos evaluadores agrupan por separado los envíos en incidentes reales, y
 * luego fijan por consenso los grupos en los que no coincidieron. El acuerdo se mide con el kappa
 * de Cohen sobre pares candidatos: para cada par de envíos que podrían ser el mismo incidente,
 * cada evaluador dice «mismo incidente» o no.
 */

export type Evaluador = 'A' | 'B' | 'CONSENSO';

/** Largo máximo del nombre de un grupo (`1`, `bloqueo-prado`...). */
export const MAX_NOMBRE_DE_GRUPO = 40;

/** Un par es candidato si sus envíos distan a lo más tantas veces el radio de deduplicación. */
export const FACTOR_DE_RADIO = 3;

/** Y si llegaron con una diferencia de a lo más 24 h. */
export const VENTANA_DE_PAR_MS = 24 * 60 * 60 * 1000;

/** Kappa mínimo del protocolo (acuerdo sustancial, Landis y Koch). */
export const KAPPA_MINIMO = 0.61;

export interface EnvioEtiquetable {
  readonly idEnvio: string;
  readonly codigoCategoria: string;
  readonly publicLocation: UbicacionPublica;
  readonly recibidoEn: Date;
}

export interface Etiqueta {
  readonly evaluador: Evaluador;
  readonly idEnvio: string;
  readonly grupo: string;
}

export interface Desacuerdo {
  readonly idEnvioA: string;
  readonly idEnvioB: string;
  /** Lo que dijo el evaluador A: `true` si son el mismo incidente. */
  readonly mismoSegunA: boolean;
  readonly mismoSegunB: boolean;
}

export interface Acuerdo {
  /** `null` si no hay pares evaluados o el kappa no está definido (azar esperado del 100 %). */
  readonly kappa: number | null;
  readonly paresCandidatos: number;
  /** Pares con los dos envíos etiquetados por ambos evaluadores. */
  readonly paresEvaluados: number;
  readonly acuerdoObservado: number | null;
  readonly desacuerdos: readonly Desacuerdo[];
}

/** Tabla de contingencia 2×2 de «mismo incidente» (sí/no) entre los dos evaluadores. */
export interface TablaDeAcuerdo {
  readonly ambosSi: number;
  readonly soloA: number;
  readonly soloB: number;
  readonly ambosNo: number;
}

/**
 * Kappa de Cohen de una tabla 2×2. Devuelve `null` si la tabla está vacía o si el acuerdo
 * esperado por azar es total (los dos dijeron siempre lo mismo y no hay variación que medir).
 */
export function kappaDeCohen(tabla: TablaDeAcuerdo): number | null {
  const n = tabla.ambosSi + tabla.soloA + tabla.soloB + tabla.ambosNo;
  if (n === 0) return null;
  const observado = (tabla.ambosSi + tabla.ambosNo) / n;
  const siA = (tabla.ambosSi + tabla.soloA) / n;
  const siB = (tabla.ambosSi + tabla.soloB) / n;
  const esperado = siA * siB + (1 - siA) * (1 - siB);
  if (esperado === 1) return null;
  return (observado - esperado) / (1 - esperado);
}

const distancia = (a: UbicacionPublica, b: UbicacionPublica): number =>
  PuntoGeo.crear(a.latitud, a.longitud).distanciaA(PuntoGeo.crear(b.latitud, b.longitud));

/**
 * Pares de envíos que podrían ser el mismo incidente: misma categoría, a lo más 24 h entre ellos
 * y a lo más tres radios de deduplicación de su categoría. Una categoría sin radio no forma pares.
 */
export function paresCandidatos(
  envios: readonly EnvioEtiquetable[],
  radioPorCategoria: ReadonlyMap<string, number>,
): [EnvioEtiquetable, EnvioEtiquetable][] {
  const ordenados = envios.toSorted((a, b) => a.recibidoEn.getTime() - b.recibidoEn.getTime());
  const pares: [EnvioEtiquetable, EnvioEtiquetable][] = [];
  for (let i = 0; i < ordenados.length; i += 1) {
    const a = ordenados[i]!;
    const radio = radioPorCategoria.get(a.codigoCategoria);
    if (radio === undefined) continue;
    for (let j = i + 1; j < ordenados.length; j += 1) {
      const b = ordenados[j]!;
      if (b.recibidoEn.getTime() - a.recibidoEn.getTime() > VENTANA_DE_PAR_MS) break;
      const cerca = distancia(a.publicLocation, b.publicLocation) <= FACTOR_DE_RADIO * radio;
      if (b.codigoCategoria === a.codigoCategoria && cerca) pares.push([a, b]);
    }
  }
  return pares;
}

const grupos = (etiquetas: readonly Etiqueta[], evaluador: Evaluador): Map<string, string> =>
  new Map(etiquetas.filter((e) => e.evaluador === evaluador).map((e) => [e.idEnvio, e.grupo]));

/** Si el evaluador puso los dos envíos en el mismo grupo; `null` si le falta etiquetar alguno. */
function mismoGrupo(grupos: ReadonlyMap<string, string>, x: string, y: string): boolean | null {
  const [gx, gy] = [grupos.get(x), grupos.get(y)];
  return gx === undefined || gy === undefined ? null : gx === gy;
}

function celda(mismoSegunA: boolean, mismoSegunB: boolean): keyof TablaDeAcuerdo {
  if (mismoSegunA) return mismoSegunB ? 'ambosSi' : 'soloA';
  return mismoSegunB ? 'soloB' : 'ambosNo';
}

/** Acuerdo entre A y B sobre los pares candidatos, con la lista de desacuerdos para el consenso. */
export function medirAcuerdo(
  envios: readonly EnvioEtiquetable[],
  etiquetas: readonly Etiqueta[],
  radioPorCategoria: ReadonlyMap<string, number>,
): Acuerdo {
  const deA = grupos(etiquetas, 'A');
  const deB = grupos(etiquetas, 'B');
  const pares = paresCandidatos(envios, radioPorCategoria);
  const tabla = { ambosSi: 0, soloA: 0, soloB: 0, ambosNo: 0 };
  const desacuerdos: Desacuerdo[] = [];
  let evaluados = 0;
  for (const [x, y] of pares) {
    const mismoSegunA = mismoGrupo(deA, x.idEnvio, y.idEnvio);
    const mismoSegunB = mismoGrupo(deB, x.idEnvio, y.idEnvio);
    if (mismoSegunA === null || mismoSegunB === null) continue;
    evaluados += 1;
    tabla[celda(mismoSegunA, mismoSegunB)] += 1;
    if (mismoSegunA !== mismoSegunB) {
      desacuerdos.push({ idEnvioA: x.idEnvio, idEnvioB: y.idEnvio, mismoSegunA, mismoSegunB });
    }
  }
  return {
    kappa: kappaDeCohen(tabla),
    paresCandidatos: pares.length,
    paresEvaluados: evaluados,
    acuerdoObservado: evaluados === 0 ? null : (tabla.ambosSi + tabla.ambosNo) / evaluados,
    desacuerdos,
  };
}
