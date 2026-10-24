import { PuntoGeo, idReporte, idUsuario } from '@gis/shared-kernel';
import type { IdUsuario } from '@gis/shared-kernel';
import type { InstantaneaDeReporte } from '../domain/report-snapshot.js';
import { Reputacion } from '../domain/reputation.js';
import { Voto } from '../domain/vote.js';
import type { ValorVoto } from '../domain/vote.js';

export const ahora = new Date('2026-10-11T12:00:00Z');
export const diasDespues = (dias: number) => new Date(ahora.getTime() + dias * 86_400_000);

/** Identificador de usuario determinista a partir de un número. */
export const usuario = (n: number): IdUsuario =>
  idUsuario(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);

export const AUTOR = usuario(999);
export const ID_REPORTE = idReporte('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f');

/** Ubicación del incidente y puntos a distancias conocidas hacia el norte. */
export const lugarDelIncidente = PuntoGeo.crear(-16.5, -68.15);
const GRADOS_POR_METRO = 1 / 111_195;
export const aMetros = (metros: number) =>
  PuntoGeo.crear(-16.5 + metros * GRADOS_POR_METRO, -68.15);

export const reporte = (cambios: Partial<InstantaneaDeReporte> = {}): InstantaneaDeReporte => ({
  id: ID_REPORTE,
  authorId: AUTOR,
  estado: 'ACTIVO',
  location: lugarDelIncidente,
  extensiones: 0,
  esOficial: false,
  ...cambios,
});

export const reputacion = (userIdValue: IdUsuario, score = 1.0): Reputacion =>
  Reputacion.restaurar({ idUsuario: userIdValue, puntaje: score, ultimaPenalizacionEn: null });

/** Voto ya emitido, con el peso indicado. */
export const voto = (n: number, value: ValorVoto, weight = 1.0): Voto =>
  Voto.restaurar({
    idReporte: ID_REPORTE,
    idVotante: usuario(n),
    valor: value,
    peso: weight,
    emitidoEn: ahora,
  });
