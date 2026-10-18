import type { SuscripcionPush } from '../domain/suscripcion-push.js';

/**
 * Lo que viaja en un aviso push (HU-08). Solo datos públicos: nunca el autor ni la ubicación
 * real del reporte.
 */
export interface ContenidoDeAviso {
  readonly idReporte: string;
  readonly codigoCategoria: string;
  readonly publicLocation: { readonly latitud: number; readonly longitud: number };
}

/** El servicio push respondió que la suscripción ya no existe (404 o 410): hay que olvidarla. */
export class ErrorSuscripcionVencida extends Error {
  constructor() {
    super('La suscripción push ya no existe en el servicio del navegador');
  }
}

/** Canal Web Push. Lo implementa el adaptador `EmisorWebPush` (VAPID). */
export interface EmisorPush {
  /** @throws {ErrorSuscripcionVencida} si el servicio push ya no reconoce la suscripción. */
  enviar(suscripcion: SuscripcionPush, contenido: ContenidoDeAviso): Promise<void>;
}
