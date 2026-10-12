import { categoryCode, GeoPoint, userId } from '@gis/shared-kernel';
import { subscriptionId, ZoneSubscription } from '../domain/zone-subscription.js';
import type { CreateZoneSubscriptionInput } from '../domain/zone-subscription.js';

export const ahora = new Date('2026-10-12T12:00:00.000Z');
export const ana = userId('11111111-1111-4111-8111-111111111111');
export const beto = userId('22222222-2222-4222-8222-222222222222');
export const plazaMurillo = GeoPoint.create(-16.4955, -68.1336);
export const bloqueo = categoryCode('bloqueo');
export const robo = categoryCode('robo');

/** Identificador de zona determinista a partir de un número. */
export const idZona = (n: number) =>
  subscriptionId(`dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12, '0')}`);

export const zona = (cambios: Partial<CreateZoneSubscriptionInput> = {}): ZoneSubscription =>
  ZoneSubscription.create({
    id: idZona(1),
    userId: ana,
    center: plazaMurillo,
    radiusM: 800,
    categories: [bloqueo, robo],
    now: ahora,
    ...cambios,
  });
