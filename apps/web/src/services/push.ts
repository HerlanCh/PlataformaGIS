// Avisos Web Push del dispositivo (HU-08): suscribirse con la clave VAPID de la API y enviar la
// suscripción, o darla de baja. El permiso de notificaciones solo se pide cuando la persona toca
// «Activar avisos».
import { esRechazo, JSON_CABECERA, pedirConToken } from './peticion.js';

export type EstadoDeAvisos =
  /** El navegador no tiene Web Push. */
  | 'no-compatible'
  /** iPhone o iPad sin la app instalada: Safari solo entrega avisos a la app de inicio. */
  | 'requiere-instalar'
  /** La persona negó el permiso; solo se cambia en la configuración del navegador. */
  | 'bloqueados'
  | 'activos'
  | 'inactivos';

/** La API no ofrece avisos (módulo apagado o sin claves VAPID). */
export class AvisosNoDisponibles extends Error {}

export const esIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

/** Abierta como app instalada, no en una pestaña del navegador. */
export const estaInstalada = (): boolean =>
  globalThis.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const tieneWebPush = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis;

/** Sin service worker registrado (por ejemplo, en `vite dev`) no hay suscripción. */
async function suscripcionActual(): Promise<PushSubscription | null> {
  const registro = await navigator.serviceWorker.getRegistration();
  return registro ? registro.pushManager.getSubscription() : null;
}

export async function estadoDeAvisos(): Promise<EstadoDeAvisos> {
  if (esIos() && !estaInstalada()) return 'requiere-instalar';
  if (!tieneWebPush() || !(await navigator.serviceWorker.getRegistration())) {
    return 'no-compatible';
  }
  if (Notification.permission === 'denied') return 'bloqueados';
  if (Notification.permission !== 'granted') return 'inactivos';
  return (await suscripcionActual()) ? 'activos' : 'inactivos';
}

/** La clave VAPID llega en base64 de URL; `pushManager.subscribe` la quiere en bytes. */
export function aBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replaceAll('-', '+').replaceAll('_', '/');
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const binario = atob(base64 + relleno);
  return Uint8Array.from(binario, (c) => c.codePointAt(0)!);
}

async function clavePublica(urlApi: string, pedir: typeof fetch): Promise<string> {
  const respuesta = await pedir(`${urlApi}/v1/notificaciones/clave-publica`);
  if (respuesta.status === 404) throw new AvisosNoDisponibles();
  if (!respuesta.ok) throw new Error('No se pudo leer la clave de los avisos');
  return ((await respuesta.json()) as { clavePublica: string }).clavePublica;
}

/** Pide el permiso, se suscribe y registra el dispositivo en la API. */
export async function activarAvisos(
  urlApi: string,
  pedir: typeof fetch = fetch,
): Promise<EstadoDeAvisos> {
  const permiso = await Notification.requestPermission();
  if (permiso === 'denied') return 'bloqueados';
  if (permiso !== 'granted') return 'inactivos';

  const clave = await clavePublica(urlApi, pedir);
  const registro = await navigator.serviceWorker.ready;
  const suscripcion = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: aBytes(clave),
  });
  const respuesta = await pedirConToken(urlApi, pedir, '/v1/notificaciones/push', {
    method: 'POST',
    headers: JSON_CABECERA,
    body: JSON.stringify(suscripcion.toJSON()),
  });
  if (respuesta.status === 404) throw new AvisosNoDisponibles();
  if (!respuesta.ok) throw new Error(esRechazo(respuesta) ? 'Suscripción rechazada' : 'Sin red');
  return 'activos';
}

/** Deja de recibir avisos en este dispositivo: lo da de baja en la API y en el navegador. */
export async function desactivarAvisos(
  urlApi: string,
  pedir: typeof fetch = fetch,
): Promise<EstadoDeAvisos> {
  const suscripcion = await suscripcionActual();
  if (suscripcion) {
    await pedirConToken(urlApi, pedir, '/v1/notificaciones/push', {
      method: 'DELETE',
      headers: JSON_CABECERA,
      body: JSON.stringify({ endpoint: suscripcion.endpoint }),
    });
    await suscripcion.unsubscribe();
  }
  return 'inactivos';
}
