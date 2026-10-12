import type { UserId } from '@gis/shared-kernel';
import type { SubscriptionId, ZoneSubscription } from './zone-subscription.js';

/** La búsqueda de zonas que contienen un punto (para notificar) se añade en la Fase 4. */
export interface SubscriptionRepository {
  findById(id: SubscriptionId): Promise<ZoneSubscription | null>;
  findByUser(userId: UserId): Promise<readonly ZoneSubscription[]>;
  save(subscription: ZoneSubscription): Promise<void>;
  /** Indica si la zona existía. */
  delete(id: SubscriptionId): Promise<boolean>;
}
