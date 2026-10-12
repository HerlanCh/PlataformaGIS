import type { IdReporte, IdUsuario } from '@gis/shared-kernel';
import type { InstantaneaDeReporte } from './report-snapshot.js';
import type { Reputacion } from './reputation.js';
import type { Voto } from './vote.js';

/**
 * Puerto propio hacia `reports`. La raíz de composición lo conecta con la interfaz
 * pública de ese módulo (ADR-001): `verification` nunca lo importa.
 */
export interface ConsultaDeReporte {
  buscarPorId(id: IdReporte): Promise<InstantaneaDeReporte | null>;
}

export interface RepositorioDeVotos {
  buscarPorReporte(idReporte: IdReporte): Promise<readonly Voto[]>;
  existe(idReporte: IdReporte, idVotante: IdUsuario): Promise<boolean>;
  guardar(voto: Voto): Promise<void>;
}

export interface RepositorioDeReputaciones {
  buscarPorUsuario(idUsuario: IdUsuario): Promise<Reputacion | null>;
  guardar(reputacion: Reputacion): Promise<void>;
}
