import type { EventoDeIntegracion } from '@gis/contracts';
import type { Reputacion } from '../domain/reputation.js';
import type { Voto } from '../domain/vote.js';

/** Escrituras transaccionales de `verification`: lo que se guarda junto, o no se guarda. */
export interface UnidadDeTrabajoDeVoto {
  /**
   * Guarda el voto, la reputación del votante (pudo recuperarse o crearse) y los eventos.
   * @throws {ErrorYaVoto} si otro voto simultáneo del mismo usuario llegó antes.
   */
  registrarVoto(
    voto: Voto,
    votante: Reputacion,
    eventos: readonly EventoDeIntegracion[],
  ): Promise<void>;
  /** Guarda varias reputaciones ajustadas por un mismo desenlace. */
  guardarReputaciones(reputaciones: readonly Reputacion[]): Promise<void>;
}
