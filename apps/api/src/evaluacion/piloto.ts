// Los comandos del análisis del piloto (ADR-007) sin la línea de comandos, para probarlos:
// `pnpm piloto:exportar`, `pnpm piloto:analizar` y `pnpm piloto:sensibilidad`. Las rutas que llegan
// como argumento siempre quedan dentro del repositorio.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExportarEvaluacion } from '@gis/module-evaluation';
import { CATEGORIAS_MVP } from '@gis/module-reports';
import { rutaDentroDe } from '../administracion/clasificador.js';
import { analizar } from './analisis.js';
import type { Indicador, ResultadoDelAnalisis } from './analisis.js';
import { escribirCsv } from './csv.js';
import { leerCarpeta } from './datos.js';
import { sensibilidad } from './sensibilidad.js';
import type { Categoria } from './simulador.js';

/** TTL y radio de deduplicación de cada categoría del SRS 3.1. */
export const CATEGORIAS: ReadonlyMap<string, Categoria> = new Map(
  CATEGORIAS_MVP.map((c) => [
    c.codigo,
    { ttlMinutos: c.ttlMinutos, radioDuplicadoM: c.radioDuplicadoM },
  ]),
);

const TTL = new Map([...CATEGORIAS].map(([c, v]) => [c, v.ttlMinutos]));

const COLUMNAS = {
  indicadores: ['hipotesis', 'indicador', 'tipo', 'vista', 'unidad', 'valor', 'n'],
  tareas: [
    'participante',
    'secuencia',
    'orden',
    'vista',
    'escenario',
    'duracion_ms',
    'agotada',
    'aciertos',
    'omisiones',
    'de_mas',
    'neutras',
    'tasa_acierto',
    'tasa_omision',
  ],
  incidentes: ['grupo', 'categoria', 'items_base', 'items_procesada'],
  veracidad: ['id_reporte', 'categoria', 'confirmado', 'real'],
  vigencia: [
    'grupo',
    'categoria',
    'exceso_procesada_min',
    'exceso_base_min',
    'prematuro',
    'anticipo_min',
  ],
  supervivencia: ['grupo', 'categoria', 'minutos', 'evento', 'ttl_minutos'],
  costos: ['hipotesis', 'indicador', 'casos', 'total'],
  sensibilidad: [
    'umbral',
    'factor_radio',
    'factor_ttl',
    'hipotesis',
    'indicador',
    'tipo',
    'vista',
    'unidad',
    'valor',
    'n',
  ],
} as const;

type Filas = readonly Record<string, string | number | boolean | null>[];

/** Exporta el registro y las herramientas a `<carpeta>/<tabla>.csv`. */
export async function exportarACarpeta(opciones: {
  readonly raiz: string;
  readonly carpeta: string;
  readonly exportar: Pick<ExportarEvaluacion, 'ejecutar'>;
}): Promise<string[]> {
  const carpeta = rutaDentroDe(opciones.raiz, opciones.carpeta, '');
  const tablas = await opciones.exportar.ejecutar({ rolActor: 'MODERADOR' });
  await mkdir(carpeta, { recursive: true });
  const escritos = Object.entries(tablas).map(
    ([tabla, csv]) => [join(carpeta, `${tabla}.csv`), csv] as const,
  );
  await Promise.all(escritos.map(([ruta, csv]) => writeFile(ruta, csv)));
  return escritos.map(([ruta]) => ruta);
}

const valor = (v: number | null) => (v === null ? '—' : String(v));

/** El resumen legible del análisis, para la bitácora y el informe de validación. */
export function aMarkdown(resultado: ResultadoDelAnalisis): string {
  const fila = (i: Indicador) =>
    `| ${i.hipotesis} | ${i.indicador} | ${i.tipo} | ${i.vista} | ${valor(i.valor)} | ${i.unidad} | ${i.n} |`;
  return [
    '# Análisis del piloto (ADR-007)',
    '',
    `Tareas analizadas: ${resultado.tareas.length}. Reportes verificados: ${resultado.veracidad.length}.`,
    'Las pruebas inferenciales están en la salida de `tools/piloto/contraste.R`.',
    ...resultado.avisos.map((a) => `\n> **Aviso:** ${a}`),
    '',
    '| Hipótesis | Indicador | Tipo | Vista | Valor | Unidad | n |',
    '| :--- | :--- | :--- | :--- | ---: | :--- | ---: |',
    ...resultado.indicadores.map(fila),
    '',
  ].join('\n');
}

/**
 * Analiza la exportación de `carpeta` y deja en `salida` los CSV que lee `contraste.R` y un
 * resumen en Markdown.
 */
export async function analizarCarpeta(opciones: {
  readonly raiz: string;
  readonly carpeta: string;
  readonly salida: string;
}): Promise<ResultadoDelAnalisis> {
  const carpeta = rutaDentroDe(opciones.raiz, opciones.carpeta, '');
  const salida = rutaDentroDe(opciones.raiz, opciones.salida, '');
  const resultado = analizar(await leerCarpeta(carpeta), TTL);
  await mkdir(salida, { recursive: true });
  const archivos: [string, string][] = [
    [
      'indicadores.csv',
      escribirCsv(COLUMNAS.indicadores, resultado.indicadores as unknown as Filas),
    ],
    ['tareas.csv', escribirCsv(COLUMNAS.tareas, resultado.tareas as unknown as Filas)],
    ['incidentes.csv', escribirCsv(COLUMNAS.incidentes, resultado.incidentes as unknown as Filas)],
    ['veracidad.csv', escribirCsv(COLUMNAS.veracidad, resultado.veracidad as unknown as Filas)],
    ['vigencia.csv', escribirCsv(COLUMNAS.vigencia, resultado.vigencia as unknown as Filas)],
    [
      'supervivencia.csv',
      escribirCsv(COLUMNAS.supervivencia, resultado.supervivencia as unknown as Filas),
    ],
    ['costos.csv', escribirCsv(COLUMNAS.costos, resultado.costos as unknown as Filas)],
    ['resumen.md', aMarkdown(resultado)],
  ];
  await Promise.all(archivos.map(([nombre, texto]) => writeFile(join(salida, nombre), texto)));
  return resultado;
}

/** La malla de sensibilidad sobre la exportación de `carpeta`, en un CSV. */
export async function sensibilidadDeCarpeta(opciones: {
  readonly raiz: string;
  readonly carpeta: string;
  readonly destino: string;
}): Promise<number> {
  const carpeta = rutaDentroDe(opciones.raiz, opciones.carpeta, '');
  const destino = rutaDentroDe(opciones.raiz, opciones.destino, '.csv');
  const filas = sensibilidad(await leerCarpeta(carpeta), CATEGORIAS);
  await writeFile(destino, escribirCsv(COLUMNAS.sensibilidad, filas as unknown as Filas));
  return filas.length;
}
