import { validarEntrada } from '@gis/contracts';
import { ErrorLimiteExcedido, idReporte, idUsuario } from '@gis/shared-kernel';
import type { LimitadorDeFrecuencia } from '@gis/shared-kernel';
import { z } from 'zod';
import type { ValorVoto } from '../domain/vote.js';
import { emitirVoto } from './emitir-voto.js';
import type { DependenciasDeVoto, VotoRegistrado } from './emitir-voto.js';

/** Límite de votos por usuario (SRS 3.3). */
export const LIMITE_DE_VOTOS = { cantidad: 30, ventanaSegundos: 10 * 60 } as const;

const esquemaEntrada = z.object({
  idReporte: z.uuid(),
  idVotante: z.uuid(),
  /** Posición del votante: debe estar a 1000 m o menos del incidente. */
  latitud: z.number(),
  longitud: z.number(),
});

export type EntradaVotarReporte = z.input<typeof esquemaEntrada>;

export interface DependenciasVotarReporte extends DependenciasDeVoto {
  readonly limitador: LimitadorDeFrecuencia;
}

/** HU-03 ("¿Sigue ahí?"): registra un voto ponderado por la reputación del votante. */
export class VotarReporte {
  constructor(
    private readonly deps: DependenciasVotarReporte,
    private readonly valor: ValorVoto,
  ) {}

  async ejecutar(entrada: EntradaVotarReporte): Promise<VotoRegistrado> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    const idVotante = idUsuario(datos.idVotante);
    const { cantidad, ventanaSegundos } = LIMITE_DE_VOTOS;
    const consumo = await this.deps.limitador.consumir(
      `votos:${idVotante}`,
      cantidad,
      ventanaSegundos,
    );
    if (!consumo.permitido) throw new ErrorLimiteExcedido(consumo.reintentarEnSegundos);

    return emitirVoto(this.deps, {
      idReporte: idReporte(datos.idReporte),
      idVotante,
      latitud: datos.latitud,
      longitud: datos.longitud,
      valor: this.valor,
    });
  }
}

/** "¿Sigue ahí? → Sí". */
export class ConfirmarReporte extends VotarReporte {
  constructor(deps: DependenciasVotarReporte) {
    super(deps, 'CONFIRMACION');
  }
}

/** "¿Sigue ahí? → No". */
export class NegarReporte extends VotarReporte {
  constructor(deps: DependenciasVotarReporte) {
    super(deps, 'NEGACION');
  }
}
