import type { ConsultaDeReportesFinalizados } from '../domain/ports.js';
import type { RegistrarDatoAbierto } from './registrar-dato-abierto.js';

export const LOTE_DEL_HISTORICO = 500;

/**
 * Carga en los datos abiertos los reportes que terminaron antes de activar el módulo
 * (`pnpm datos-abiertos:cargar`). Se puede repetir: lo ya cargado no se duplica.
 */
export class CargarHistorico {
  constructor(
    private readonly reportes: ConsultaDeReportesFinalizados,
    private readonly registrar: Pick<RegistrarDatoAbierto, 'registrar'>,
  ) {}

  /** Devuelve cuántas filas nuevas agregó. */
  async ejecutar(lote = LOTE_DEL_HISTORICO): Promise<number> {
    let nuevas = 0;
    let despuesDe: string | null = null;
    for (;;) {
      const ids: readonly string[] = await this.reportes.idsFinalizados(despuesDe, lote);
      for (const id of ids) if (await this.registrar.registrar(id)) nuevas += 1;
      if (ids.length < lote) return nuevas;
      despuesDe = ids.at(-1)!;
    }
  }
}
