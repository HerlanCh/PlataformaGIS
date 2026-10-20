import type { ResultadoDeEvaluacion } from '@gis/module-classifier';

const pct = (valor: number | null): string =>
  valor === null ? '—' : `${(valor * 100).toFixed(1).replace('.', ',')} %`;

const celda = (texto: string): string => texto.replaceAll('|', '\\|');

/** Informe en Markdown de una evaluación del clasificador (HU-10), para `docs/clasificador/`. */
export function informeDeEvaluacion(
  resultado: ResultadoDeEvaluacion,
  datos: { readonly conjunto: string; readonly totalDeEjemplos: number; readonly fecha: string },
): string {
  const m = resultado.metricas;
  const fallos = resultado.fallos.map(
    (f) =>
      `| ${f.esperado === 'SOSPECHOSO' ? 'Falso negativo' : 'Falso positivo'} | ${celda(f.texto)} | ${
        f.motivos.length > 0 ? f.motivos.join(', ') : '—'
      } |`,
  );
  return [
    '# Evaluación del clasificador',
    '',
    `Generado con \`pnpm clasificador:evaluar\` el ${datos.fecha}. No editar a mano.`,
    '',
    `- **Clasificador:** \`${resultado.clasificador}\``,
    `- **Conjunto:** \`${datos.conjunto}\`, ${datos.totalDeEjemplos} ejemplos; se mide sobre su partición de prueba (${resultado.ejemplosDePrueba} ejemplos, elegidos por un hash estable del texto).`,
    '',
    '## Métricas',
    '',
    '| Métrica | Valor |',
    '| :-- | --: |',
    `| Precisión (de lo marcado, cuánto era sospechoso) | ${pct(m.precision)} |`,
    `| Exhaustividad (de lo sospechoso, cuánto se marcó) | ${pct(m.exhaustividad)} |`,
    `| F1 | ${pct(m.f1)} |`,
    '',
    '| | Marcado | No marcado |',
    '| :-- | --: | --: |',
    `| **Sospechoso** | ${m.verdaderosPositivos} | ${m.falsosNegativos} |`,
    `| **Normal** | ${m.falsosPositivos} | ${m.verdaderosNegativos} |`,
    '',
    '## Fallos',
    '',
    ...(fallos.length === 0
      ? ['Ninguno.']
      : ['| Tipo | Texto | Motivos |', '| :-- | :-- | :-- |', ...fallos]),
    '',
  ].join('\n');
}
