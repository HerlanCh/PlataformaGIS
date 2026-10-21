// Lógica de los scripts del clasificador (HU-10): evaluarlo y exportar el conjunto etiquetado.
// Los scripts solo leen los argumentos y llaman a estas funciones.
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aJsonl,
  ClasificadorPorReglas,
  deJsonl,
  EvaluarClasificador,
  ExportarConjuntoEtiquetado,
} from '@gis/module-classifier';
import type { FuenteDeDecisiones, ResultadoDeEvaluacion } from '@gis/module-classifier';
import { informeDeEvaluacion } from './informe-de-evaluacion.js';

export const RAIZ_DEL_REPOSITORIO = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Ruta de un argumento de la línea de comandos, siempre dentro de `raiz` y con la extensión
 * pedida: un argumento como `../../etc/passwd` no puede leer ni escribir fuera del repositorio.
 * @throws {Error} si sale de `raiz` o no tiene la extensión.
 */
export function rutaDentroDe(raiz: string, argumento: string, extension: string): string {
  const ruta = resolve(raiz, argumento);
  const desdeLaRaiz = relative(raiz, ruta);
  if (desdeLaRaiz === '' || desdeLaRaiz.startsWith('..') || isAbsolute(desdeLaRaiz)) {
    throw new Error(`La ruta debe estar dentro del repositorio: ${argumento}`);
  }
  if (!ruta.endsWith(extension)) {
    throw new Error(`La ruta debe terminar en ${extension}: ${argumento}`);
  }
  return ruta;
}

export const CONJUNTO_SINTETICO = 'tools/clasificador/conjunto-sintetico.jsonl';
export const INFORME = 'docs/clasificador/evaluacion.md';

/**
 * Evalúa las reglas sobre un conjunto etiquetado y escribe el informe en Markdown
 * (`pnpm clasificador:evaluar`).
 */
export async function evaluarYEscribirInforme(opciones: {
  readonly raiz: string;
  readonly conjunto: string;
  readonly fecha: Date;
}): Promise<ResultadoDeEvaluacion> {
  const conjunto = rutaDentroDe(opciones.raiz, opciones.conjunto, '.jsonl');
  const ejemplos = deJsonl(await readFile(conjunto, 'utf8'));
  const resultado = await new EvaluarClasificador(new ClasificadorPorReglas()).ejecutar(ejemplos);
  await writeFile(
    rutaDentroDe(opciones.raiz, INFORME, '.md'),
    informeDeEvaluacion(resultado, {
      conjunto: relative(opciones.raiz, conjunto).split(sep).join('/'),
      totalDeEjemplos: ejemplos.length,
      fecha: opciones.fecha.toISOString().slice(0, 10),
    }),
  );
  return resultado;
}

/** Escribe el conjunto etiquetado en JSON Lines (`pnpm clasificador:exportar`). Devuelve cuántos. */
export async function exportarConjunto(opciones: {
  readonly raiz: string;
  readonly destino: string;
  readonly fuente: FuenteDeDecisiones;
}): Promise<number> {
  const destino = rutaDentroDe(opciones.raiz, opciones.destino, '.jsonl');
  const ejemplos = await new ExportarConjuntoEtiquetado(opciones.fuente).ejecutar();
  await writeFile(destino, aJsonl(ejemplos));
  return ejemplos.length;
}
