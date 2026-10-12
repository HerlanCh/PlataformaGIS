import { codigoCategoria, PuntoGeo, idUsuario } from '@gis/shared-kernel';
import { idSuscripcion, ZonaSuscrita } from '../domain/zone-subscription.js';
import type { EntradaCrearZonaSuscrita } from '../domain/zone-subscription.js';

export const ahora = new Date('2026-10-12T12:00:00.000Z');
export const ana = idUsuario('11111111-1111-4111-8111-111111111111');
export const beto = idUsuario('22222222-2222-4222-8222-222222222222');
export const plazaMurillo = PuntoGeo.crear(-16.4955, -68.1336);
export const bloqueo = codigoCategoria('bloqueo');
export const robo = codigoCategoria('robo');

/** Identificador de zona determinista a partir de un número. */
export const idZona = (n: number) =>
  idSuscripcion(`dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12, '0')}`);

export const zona = (cambios: Partial<EntradaCrearZonaSuscrita> = {}): ZonaSuscrita =>
  ZonaSuscrita.crear({
    id: idZona(1),
    idUsuario: ana,
    centro: plazaMurillo,
    radioM: 800,
    categorias: [bloqueo, robo],
    ahora: ahora,
    ...cambios,
  });
