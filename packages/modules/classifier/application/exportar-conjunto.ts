import type { Ejemplo, Etiqueta } from '../domain/evaluacion.js';

/** Una decisión de moderación sobre un reporte, con la descripción que tenía. */
export interface DecisionModerada {
  readonly accion: 'RECHAZAR' | 'MANTENER';
  readonly descripcion: string | null;
}

/**
 * Puerto hacia `moderation` y `reports`: la última decisión de cada reporte moderado y su
 * descripción. Lo conecta la raíz de composición (ADR-001). No trae autores, ubicaciones ni IDs.
 */
export interface FuenteDeDecisiones {
  decisiones(): Promise<readonly DecisionModerada[]>;
}

const ETIQUETA: Readonly<Record<DecisionModerada['accion'], Etiqueta>> = {
  RECHAZAR: 'SOSPECHOSO',
  MANTENER: 'NORMAL',
};

/**
 * Roadmap 10, IA, paso 2: exporta las descripciones moderadas como conjunto etiquetado para
 * entrenar el modelo de la Fase 13. Solo el texto y la etiqueta, sin repetir textos.
 */
export class ExportarConjuntoEtiquetado {
  constructor(private readonly fuente: FuenteDeDecisiones) {}

  async ejecutar(): Promise<readonly Ejemplo[]> {
    const vistos = new Set<string>();
    const ejemplos: Ejemplo[] = [];
    for (const { accion, descripcion } of await this.fuente.decisiones()) {
      const texto = descripcion?.trim();
      if (!texto || vistos.has(texto)) continue;
      vistos.add(texto);
      ejemplos.push({ texto, etiqueta: ETIQUETA[accion] });
    }
    return ejemplos;
  }
}

/** JSON Lines: un ejemplo por línea. */
export const aJsonl = (ejemplos: readonly Ejemplo[]): string =>
  ejemplos.map((e) => JSON.stringify(e)).join('\n') + (ejemplos.length > 0 ? '\n' : '');

/** Lee JSON Lines y descarta las líneas vacías. @throws {Error} si una línea no es un ejemplo. */
export function deJsonl(contenido: string): Ejemplo[] {
  return contenido
    .split(/\r?\n/)
    .filter((linea) => linea.trim() !== '')
    .map((linea, i) => {
      const dato = JSON.parse(linea) as Partial<Ejemplo>;
      if (
        typeof dato.texto !== 'string' ||
        (dato.etiqueta !== 'SOSPECHOSO' && dato.etiqueta !== 'NORMAL')
      ) {
        throw new Error(`La línea ${i + 1} no es un ejemplo { texto, etiqueta }`);
      }
      return { texto: dato.texto, etiqueta: dato.etiqueta };
    });
}
