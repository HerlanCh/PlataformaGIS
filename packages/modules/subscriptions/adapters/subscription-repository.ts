import type { Executor } from '@gis/platform';
import { categoryCode, GeoPoint, userId } from '@gis/shared-kernel';
import type { UserId } from '@gis/shared-kernel';
import { asc, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SubscriptionRepository } from '../domain/ports.js';
import { subscriptionId, ZoneSubscription } from '../domain/zone-subscription.js';
import type { SubscriptionId } from '../domain/zone-subscription.js';
import { zoneSubscriptions } from './schema.js';

// En PostGIS x es la longitud e y la latitud.
const columnas = {
  id: zoneSubscriptions.id,
  userId: zoneSubscriptions.userId,
  latitude: sql<number>`st_y(${zoneSubscriptions.center}::geometry)`,
  longitude: sql<number>`st_x(${zoneSubscriptions.center}::geometry)`,
  radiusM: zoneSubscriptions.radiusM,
  categories: zoneSubscriptions.categories,
  createdAt: zoneSubscriptions.createdAt,
};

interface Fila {
  readonly id: string;
  readonly userId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusM: number;
  readonly categories: string[];
  readonly createdAt: Date;
}

const aGeography = (punto: GeoPoint): SQL =>
  sql`st_setsrid(st_makepoint(${punto.longitude}, ${punto.latitude}), 4326)::geography`;

/** Mapeo explícito fila → entidad: el dominio nunca ve tipos de Drizzle. */
const aEntidad = (fila: Fila): ZoneSubscription =>
  ZoneSubscription.restore({
    id: subscriptionId(fila.id),
    userId: userId(fila.userId),
    center: GeoPoint.create(fila.latitude, fila.longitude),
    radiusM: fila.radiusM,
    categories: fila.categories.map(categoryCode),
    createdAt: fila.createdAt,
  });

export class PgSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: Executor) {}

  async findById(id: SubscriptionId): Promise<ZoneSubscription | null> {
    const [fila] = await this.db
      .select(columnas)
      .from(zoneSubscriptions)
      .where(eq(zoneSubscriptions.id, id))
      .limit(1);
    return fila ? aEntidad(fila) : null;
  }

  async findByUser(id: UserId): Promise<readonly ZoneSubscription[]> {
    const filas = await this.db
      .select(columnas)
      .from(zoneSubscriptions)
      .where(eq(zoneSubscriptions.userId, id))
      .orderBy(asc(zoneSubscriptions.createdAt), asc(zoneSubscriptions.id));
    return filas.map(aEntidad);
  }

  /** Una zona es inmutable: para cambiarla se elimina y se crea otra. */
  async save(subscription: ZoneSubscription): Promise<void> {
    await this.db.insert(zoneSubscriptions).values({
      id: subscription.id,
      userId: subscription.userId,
      center: aGeography(subscription.center),
      radiusM: subscription.radiusM,
      categories: [...subscription.categories],
      createdAt: subscription.createdAt,
    });
  }

  async delete(id: SubscriptionId): Promise<boolean> {
    const borradas = await this.db
      .delete(zoneSubscriptions)
      .where(eq(zoneSubscriptions.id, id))
      .returning({ id: zoneSubscriptions.id });
    return borradas.length > 0;
  }
}
