import { crearEvento, votoEmitidoV1 } from '@gis/contracts';
import { aErrorDeAplicacion, ErrorNoEncontrado, PuntoGeo } from '@gis/shared-kernel';
import type { GeneradorDeId, IdReporte, IdUsuario, Reloj } from '@gis/shared-kernel';
import type {
  ConsultaDeReporte,
  RepositorioDeReputaciones,
  RepositorioDeVotos,
} from '../domain/ports.js';
import { Reputacion } from '../domain/reputation.js';
import { PoliticaDeVerificacion } from '../domain/verification-policy.js';
import type { Decision } from '../domain/verification-policy.js';
import { Voto } from '../domain/vote.js';
import type { ValorVoto } from '../domain/vote.js';
import type { UnidadDeTrabajoDeVoto } from './ports.js';

export interface DependenciasDeVoto {
  readonly consultaDeReporte: ConsultaDeReporte;
  readonly votos: RepositorioDeVotos;
  readonly reputaciones: RepositorioDeReputaciones;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeVoto;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

export interface SolicitudDeVoto {
  readonly idReporte: IdReporte;
  readonly idVotante: IdUsuario;
  readonly latitud: number;
  readonly longitud: number;
  readonly valor: ValorVoto;
}

export interface VotoRegistrado {
  /** Peso con el que contó el voto: la reputación del votante (0 si está silenciado). */
  readonly peso: number;
  /** Lo que `reports` debe aplicar al reporte. */
  readonly decision: Decision;
}

/** Cómo llega a quien vota cada regla del SRS 3.2.2 que su voto incumple. */
const TIPO_POR_CODIGO = {
  FUERA_DEL_AREA_DE_SERVICIO: 'VALIDACION_FALLIDA',
  REPORTE_NO_ACTIVO: 'CONFLICTO',
  YA_VOTO: 'CONFLICTO',
  AUTOR_NO_PUEDE_VOTAR: 'PROHIBIDO',
  DEMASIADO_LEJOS_PARA_VOTAR: 'PROHIBIDO',
} as const;

/** Reputación guardada del usuario o, si nunca la tuvo, la inicial. */
export const reputacionDe = async (
  reputaciones: RepositorioDeReputaciones,
  idUsuario: IdUsuario,
): Promise<Reputacion> =>
  (await reputaciones.buscarPorUsuario(idUsuario)) ?? Reputacion.inicial(idUsuario);

/**
 * Núcleo común de los votos (HU-03) y de la confirmación por duplicado (HU-01): aplica las reglas
 * del voto, decide con todos los votos del reporte y guarda voto, reputación y `VotoEmitido.v1`.
 * @throws {ErrorDeAplicacion} si el reporte no existe o el voto incumple una regla.
 */
export async function emitirVoto(
  deps: DependenciasDeVoto,
  solicitud: SolicitudDeVoto,
): Promise<VotoRegistrado> {
  const { idReporte, idVotante, valor } = solicitud;
  const reporte = await deps.consultaDeReporte.buscarPorId(idReporte);
  if (!reporte) throw new ErrorNoEncontrado('REPORTE_NO_ENCONTRADO', 'El reporte no existe');

  const ahora = deps.reloj.ahora();
  const votante = await reputacionDe(deps.reputaciones, idVotante);
  votante.recuperarSiCorresponde(ahora);
  const [yaVoto, previos] = await Promise.all([
    deps.votos.existe(idReporte, idVotante),
    deps.votos.buscarPorReporte(idReporte),
  ]);

  try {
    const ubicacionVotante = PuntoGeo.crear(solicitud.latitud, solicitud.longitud);
    const voto = Voto.emitir({ reporte, votante, ubicacionVotante, valor, yaVoto, ahora });
    const decision = PoliticaDeVerificacion.decidir(reporte, [...previos, voto]);
    const evento = crearEvento(
      votoEmitidoV1,
      { idReporte, idVotante, valor, peso: voto.peso, decision },
      { id: deps.ids.siguiente(), ocurridoEn: ahora },
    );
    await deps.unidadDeTrabajo.registrarVoto(voto, votante, [evento]);
    return { peso: voto.peso, decision };
  } catch (error) {
    throw aErrorDeAplicacion(error, TIPO_POR_CODIGO);
  }
}
