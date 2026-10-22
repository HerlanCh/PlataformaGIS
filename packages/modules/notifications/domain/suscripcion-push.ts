import { ErrorIdentificadorInvalido } from '@gis/shared-kernel';
import type { IdUsuario, Marca } from '@gis/shared-kernel';
import { ErrorSuscripcionPushInvalida } from './errors.js';

export type IdSuscripcionPush = Marca<string, 'IdSuscripcionPush'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Claves de la suscripción: base64 de URL, como las entrega `PushSubscription.toJSON()`. */
const BASE64_URL = /^[A-Za-z0-9_-]+=*$/;
/** Ningún servicio push usa endpoints más largos; acota lo que se guarda. */
const LARGO_MAXIMO_ENDPOINT = 2048;

/** @throws {ErrorIdentificadorInvalido} si no es un UUID. */
export const idSuscripcionPush = (valor: string): IdSuscripcionPush => {
  if (!UUID.test(valor)) throw new ErrorIdentificadorInvalido('IdSuscripcionPush', valor);
  return valor as IdSuscripcionPush;
};

export interface PropsSuscripcionPush {
  readonly id: IdSuscripcionPush;
  readonly idUsuario: IdUsuario;
  /** URL del servicio push del navegador; identifica al dispositivo. */
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly creadoEn: Date;
}

/**
 * Servicios push de los navegadores: Chrome (FCM), Firefox, Edge (WNS) y Safari. El servidor envía
 * un POST al endpoint, así que aceptar cualquier URL permitiría usarlo contra la red interna (SSRF).
 */
const SERVICIOS_PUSH = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
];

const esServicioPush = (host: string): boolean =>
  SERVICIOS_PUSH.some((servicio) => host === servicio || host.endsWith(`.${servicio}`));

function endpointValido(endpoint: string): boolean {
  if (endpoint.length > LARGO_MAXIMO_ENDPOINT) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && url.port === '' && esServicioPush(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Suscripción Web Push de un dispositivo (HU-08): a dónde enviar los avisos de un usuario.
 * Inmutable; si el navegador la renueva, se guarda otra con el mismo endpoint.
 */
export class SuscripcionPush {
  readonly id: IdSuscripcionPush;
  readonly idUsuario: IdUsuario;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly creadoEn: Date;

  private constructor(props: PropsSuscripcionPush) {
    this.id = props.id;
    this.idUsuario = props.idUsuario;
    this.endpoint = props.endpoint;
    this.p256dh = props.p256dh;
    this.auth = props.auth;
    this.creadoEn = props.creadoEn;
    Object.freeze(this);
  }

  /**
   * @throws {ErrorSuscripcionPushInvalida} si el endpoint no es una URL https de un servicio push o
   * las claves no están en base64 de URL.
   */
  static crear(props: PropsSuscripcionPush): SuscripcionPush {
    const clavesValidas = [props.p256dh, props.auth].every(
      (clave) => clave.length > 0 && clave.length <= 256 && BASE64_URL.test(clave),
    );
    if (!endpointValido(props.endpoint) || !clavesValidas) throw new ErrorSuscripcionPushInvalida();
    return new SuscripcionPush(props);
  }

  /** Reconstruye una suscripción ya validada (desde la base de datos). */
  static restaurar(props: PropsSuscripcionPush): SuscripcionPush {
    return new SuscripcionPush(props);
  }
}
