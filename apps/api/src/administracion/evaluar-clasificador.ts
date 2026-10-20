// Mide el clasificador por reglas sobre un conjunto etiquetado (HU-10) y regenera
// `docs/clasificador/evaluacion.md`: `pnpm clasificador:evaluar [conjunto.jsonl]`.
// Sin argumento usa el conjunto sintético; en la Fase 13, el que exporta `clasificador:exportar`.
import { readFile, writeFile } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClasificadorPorReglas, deJsonl, EvaluarClasificador } from '@gis/module-classifier';
import { informeDeEvaluacion } from './informe-de-evaluacion.js';

const raiz = fileURLToPath(new URL('../../../../', import.meta.url));
const conjunto = process.argv[2] ?? `${raiz}tools/clasificador/conjunto-sintetico.jsonl`;
const destino = `${raiz}docs/clasificador/evaluacion.md`;

const ejemplos = deJsonl(await readFile(conjunto, 'utf8'));
const resultado = await new EvaluarClasificador(new ClasificadorPorReglas()).ejecutar(ejemplos);
await writeFile(
  destino,
  informeDeEvaluacion(resultado, {
    conjunto: relative(raiz, conjunto).split(sep).join('/'),
    totalDeEjemplos: ejemplos.length,
    fecha: new Date().toISOString().slice(0, 10),
  }),
);
const { precision, exhaustividad } = resultado.metricas;
console.log(
  `precisión ${precision?.toFixed(3)} · exhaustividad ${exhaustividad?.toFixed(3)} → ${destino}`,
);
