import { InvalidIdentifierError } from '@gis/shared-kernel';
import type { Brand, CategoryCode, GeoPoint, UserId } from '@gis/shared-kernel';
import { InvalidRadiusError, NoCategoriesError } from './errors.js';

export type SubscriptionId = Brand<string, 'SubscriptionId'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @throws {InvalidIdentifierError} si no es un UUID. */
export const subscriptionId = (valor: string): SubscriptionId => {
  if (!UUID.test(valor)) throw new InvalidIdentifierError('SubscriptionId', valor);
  return valor as SubscriptionId;
};

/** Radio permitido de una zona suscrita, en metros (SRS 3.3). */
export const ZONE_RADIUS = { minM: 100, maxM: 2000 } as const;

export interface ZoneSubscriptionProps {
  readonly id: SubscriptionId;
  readonly userId: UserId;
  readonly center: GeoPoint;
  readonly radiusM: number;
  readonly categories: readonly CategoryCode[];
  readonly createdAt: Date;
}

export interface CreateZoneSubscriptionInput {
  readonly id: SubscriptionId;
  readonly userId: UserId;
  readonly center: GeoPoint;
  readonly radiusM: number;
  readonly categories: readonly CategoryCode[];
  readonly now: Date;
}

const radioValido = (radiusM: number): boolean =>
  Number.isInteger(radiusM) && radiusM >= ZONE_RADIUS.minM && radiusM <= ZONE_RADIUS.maxM;

/** Zona de interés de un usuario: un círculo y las categorías que quiere recibir. Inmutable. */
export class ZoneSubscription {
  readonly id: SubscriptionId;
  readonly userId: UserId;
  readonly center: GeoPoint;
  readonly radiusM: number;
  readonly categories: readonly CategoryCode[];
  readonly createdAt: Date;

  private constructor(props: ZoneSubscriptionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.center = props.center;
    this.radiusM = props.radiusM;
    this.categories = Object.freeze([...props.categories]);
    this.createdAt = props.createdAt;
    Object.freeze(this);
  }

  /**
   * Crea una zona suscrita. Las categorías repetidas se guardan una sola vez.
   * @throws {InvalidRadiusError} si el radio no es un entero entre 100 m y 2000 m.
   * @throws {NoCategoriesError} si no se eligió ninguna categoría.
   */
  static create(input: CreateZoneSubscriptionInput): ZoneSubscription {
    if (!radioValido(input.radiusM)) {
      throw new InvalidRadiusError(ZONE_RADIUS.minM, ZONE_RADIUS.maxM);
    }
    const categories = [...new Set(input.categories)];
    if (categories.length === 0) throw new NoCategoriesError();

    return new ZoneSubscription({
      id: input.id,
      userId: input.userId,
      center: input.center,
      radiusM: input.radiusM,
      categories,
      createdAt: input.now,
    });
  }

  /** Reconstruye una zona ya persistida. */
  static restore(props: ZoneSubscriptionProps): ZoneSubscription {
    return new ZoneSubscription(props);
  }
}
