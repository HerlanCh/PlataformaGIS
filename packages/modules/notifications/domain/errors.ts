import { ErrorDeDominio } from '@gis/shared-kernel';

export class ErrorSuscripcionPushInvalida extends ErrorDeDominio {
  constructor() {
    super(
      'SUSCRIPCION_PUSH_INVALIDA',
      'La suscripción push necesita un endpoint https y las claves p256dh y auth',
    );
  }
}
