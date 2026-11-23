import { validarEntrada } from '@gis/contracts';
import { z } from 'zod';
import { MAX_NOMBRE_DE_GRUPO, medirAcuerdo } from '../domain/etiquetado.js';
import type { Acuerdo, EnvioEtiquetable, Etiqueta, Evaluador } from '../domain/etiquetado.js';
import type { RepositorioDeEtiquetas, RepositorioDeEvaluacion } from '../domain/ports.js';
import { esquemaPeriodo, esquemaRol, exigirModerador } from './entradas.js';

const esquemaEvaluador = z.enum(['A', 'B', 'CONSENSO']);

const esquemaListar = z.object({
  rolActor: esquemaRol,
  evaluador: esquemaEvaluador,
  periodo: esquemaPeriodo,
});

export interface EnviosParaEtiquetar {
  readonly envios: readonly EnvioEtiquetable[];
  /** Las del evaluador; en el consenso, también las de A y B. Nunca las del otro evaluador. */
  readonly etiquetas: readonly Etiqueta[];
}

/**
 * Los envíos de un periodo para que un evaluador los agrupe. No trae a qué reporte los asignó la
 * plataforma ni las etiquetas del otro evaluador: el etiquetado es ciego e independiente.
 */
export class ListarEnviosParaEtiquetar {
  constructor(
    private readonly registro: RepositorioDeEvaluacion,
    private readonly etiquetas: RepositorioDeEtiquetas,
  ) {}

  async ejecutar(entrada: z.input<typeof esquemaListar>): Promise<EnviosParaEtiquetar> {
    const { rolActor, evaluador, periodo } = validarEntrada(esquemaListar, entrada);
    exigirModerador(rolActor);
    const envios = await this.registro.buscarEnviosEtiquetables(periodo.desde, periodo.hasta);
    const visibles: readonly Evaluador[] =
      evaluador === 'CONSENSO' ? ['A', 'B', 'CONSENSO'] : [evaluador];
    const todas = await this.etiquetas.buscar(envios.map((e) => e.idEnvio));
    return { envios, etiquetas: todas.filter((e) => visibles.includes(e.evaluador)) };
  }
}

const esquemaGuardar = z.object({
  rolActor: esquemaRol,
  evaluador: esquemaEvaluador,
  asignaciones: z
    .array(
      z.object({
        idEnvio: z.uuid(),
        grupo: z.string().trim().min(1).max(MAX_NOMBRE_DE_GRUPO).nullable(),
      }),
    )
    .min(1)
    .max(2000),
});

export type EntradaGuardarEtiquetas = z.input<typeof esquemaGuardar>;

/** Guarda o corrige las asignaciones de un evaluador; un grupo nulo quita la etiqueta. */
export class GuardarEtiquetas {
  constructor(private readonly etiquetas: RepositorioDeEtiquetas) {}

  async ejecutar(entrada: EntradaGuardarEtiquetas): Promise<void> {
    const { rolActor, evaluador, asignaciones } = validarEntrada(esquemaGuardar, entrada);
    exigirModerador(rolActor);
    await this.etiquetas.guardar(evaluador, asignaciones);
  }
}

const esquemaAcuerdo = z.object({ rolActor: esquemaRol, periodo: esquemaPeriodo });

/**
 * Kappa de Cohen entre los evaluadores A y B sobre los pares candidatos del periodo. El radio de
 * deduplicación de cada categoría lo inyecta la raíz de composición desde `reports` (SRS 3.1).
 */
export class MedirAcuerdo {
  constructor(
    private readonly registro: RepositorioDeEvaluacion,
    private readonly etiquetas: RepositorioDeEtiquetas,
    private readonly radioPorCategoria: ReadonlyMap<string, number>,
  ) {}

  async ejecutar(entrada: z.input<typeof esquemaAcuerdo>): Promise<Acuerdo> {
    const { rolActor, periodo } = validarEntrada(esquemaAcuerdo, entrada);
    exigirModerador(rolActor);
    const envios = await this.registro.buscarEnviosEtiquetables(periodo.desde, periodo.hasta);
    const etiquetas = await this.etiquetas.buscar(envios.map((e) => e.idEnvio));
    return medirAcuerdo(envios, etiquetas, this.radioPorCategoria);
  }
}
