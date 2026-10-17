import type { EventoDeIntegracion } from '@gis/contracts';
import { agregarASalida } from '@gis/platform';
import type { Db } from '@gis/platform';
import type { UnidadDeTrabajoDeVoto } from '../application/ports.js';
import type { Reputacion } from '../domain/reputation.js';
import type { Voto } from '../domain/vote.js';
import { RepositorioReputacionesPg } from './reputation-repository.js';
import { RepositorioVotosPg } from './vote-repository.js';

export class UnidadDeTrabajoVotoPg implements UnidadDeTrabajoDeVoto {
  constructor(private readonly db: Db) {}

  async registrarVoto(
    voto: Voto,
    votante: Reputacion,
    eventos: readonly EventoDeIntegracion[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await new RepositorioVotosPg(tx).guardar(voto);
      await new RepositorioReputacionesPg(tx).guardar(votante);
      await agregarASalida(tx, eventos);
    });
  }

  async guardarReputaciones(reputaciones: readonly Reputacion[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const repositorio = new RepositorioReputacionesPg(tx);
      for (const reputacion of reputaciones) await repositorio.guardar(reputacion);
    });
  }
}
