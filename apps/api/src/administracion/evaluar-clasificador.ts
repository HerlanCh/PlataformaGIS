// Mide el clasificador por reglas sobre un conjunto etiquetado (HU-10) y regenera
// `docs/clasificador/evaluacion.md`: `pnpm clasificador:evaluar [conjunto.jsonl]`.
// Sin argumento usa el conjunto sintético; en la Fase 13, el que exporta `clasificador:exportar`.
import {
  CONJUNTO_SINTETICO,
  evaluarYEscribirInforme,
  INFORME,
  RAIZ_DEL_REPOSITORIO,
} from './clasificador.js';

const { metricas } = await evaluarYEscribirInforme({
  raiz: RAIZ_DEL_REPOSITORIO,
  conjunto: process.argv[2] ?? CONJUNTO_SINTETICO,
  fecha: new Date(),
});
console.log(
  `precisión ${metricas.precision?.toFixed(3)} · exhaustividad ${metricas.exhaustividad?.toFixed(3)} → ${INFORME}`,
);
