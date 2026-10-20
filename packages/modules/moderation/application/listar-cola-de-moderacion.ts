import { validarEntrada } from '@gis/contracts';
import { z } from 'zod';
import { compararPrioridad } from '../domain/caso-de-moderacion.js';
import type { CasoDeModeracion } from '../domain/caso-de-moderacion.js';
import type { ConsultaDeReporte, DetalleDeReporte, RepositorioDeCola } from '../domain/ports.js';
import { esquemaRol, exigirModerador } from './comun.js';

/** Casos que se muestran por consulta: la cola se revisa de a poco. */
export const LIMITE_DE_LA_COLA = 50;

const esquemaEntrada = z.object({ rolActor: esquemaRol });

export type EntradaListarCola = z.input<typeof esquemaEntrada>;

/** Un reporte de la cola con lo que el moderador necesita para decidir. */
export interface ElementoDeCola extends DetalleDeReporte {
  readonly negaciones: number;
  readonly marcado: boolean;
  readonly motivos: readonly string[];
}

const esVigente = (detalle: DetalleDeReporte): boolean =>
  detalle.estado === 'ACTIVO' || detalle.estado === 'CONFIRMADO';

const elemento = (caso: CasoDeModeracion, detalle: DetalleDeReporte): ElementoDeCola => ({
  ...detalle,
  negaciones: caso.negaciones,
  marcado: caso.marcado,
  motivos: caso.motivos,
});

/**
 * HU-12 y HU-10: la cola de moderación, primero lo que marcó el clasificador y después lo más
 * negado. Solo para moderadores: incluye la descripción privada.
 */
export class ListarColaDeModeracion {
  constructor(
    private readonly cola: RepositorioDeCola,
    private readonly consultaDeReporte: ConsultaDeReporte,
  ) {}

  async ejecutar(entrada: EntradaListarCola): Promise<readonly ElementoDeCola[]> {
    exigirModerador(validarEntrada(esquemaEntrada, entrada).rolActor);
    const casos = [...(await this.cola.listarPendientes(LIMITE_DE_LA_COLA))].sort(
      compararPrioridad,
    );
    const detalles = await this.consultaDeReporte.detallesDe(casos.map((c) => c.idReporte));
    const porId = new Map(detalles.map((d) => [d.idReporte, d]));
    // Un reporte que ya no está vigente sale de la cola aunque su desenlace aún no se procese.
    return casos.flatMap((caso) => {
      const detalle = porId.get(caso.idReporte);
      return detalle && esVigente(detalle) ? [elemento(caso, detalle)] : [];
    });
  }
}
