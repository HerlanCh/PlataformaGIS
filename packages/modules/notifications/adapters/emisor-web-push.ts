import webpush from 'web-push';
import type { PushSubscription, RequestOptions, SendResult } from 'web-push';
import { ErrorSuscripcionVencida } from '../application/ports.js';
import type { ContenidoDeAviso, EmisorPush } from '../application/ports.js';
import type { SuscripcionPush } from '../domain/suscripcion-push.js';

export interface ClavesVapid {
  readonly publica: string;
  readonly privada: string;
  /** `mailto:` o URL de contacto que exige VAPID para que el servicio push pueda avisar. */
  readonly contacto: string;
}

/** Envío de `web-push`; se inyecta para probar el adaptador sin red. */
export type EnviarNotificacion = (
  suscripcion: PushSubscription,
  cuerpo: string,
  opciones: RequestOptions,
) => Promise<SendResult>;

/** Un aviso de incidente pierde sentido después de su vigencia más corta (2 h). */
const VIGENCIA_S = 2 * 60 * 60;

/** Adaptador de `EmisorPush` con la librería `web-push` y claves VAPID. */
export class EmisorWebPush implements EmisorPush {
  constructor(
    private readonly claves: ClavesVapid,
    private readonly enviarNotificacion: EnviarNotificacion = (s, c, o) =>
      webpush.sendNotification(s, c, o),
  ) {}

  async enviar(suscripcion: SuscripcionPush, contenido: ContenidoDeAviso): Promise<void> {
    try {
      await this.enviarNotificacion(
        {
          endpoint: suscripcion.endpoint,
          keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
        },
        JSON.stringify({ tipo: 'reporte-en-zona', ...contenido }),
        {
          TTL: VIGENCIA_S,
          urgency: 'high',
          vapidDetails: {
            subject: this.claves.contacto,
            publicKey: this.claves.publica,
            privateKey: this.claves.privada,
          },
        },
      );
    } catch (error) {
      const estado = (error as { statusCode?: number }).statusCode;
      if (estado === 404 || estado === 410) throw new ErrorSuscripcionVencida();
      throw error;
    }
  }
}
