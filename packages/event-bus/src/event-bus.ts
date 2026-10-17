import type { EventoDeIntegracion } from '@gis/contracts';

export type ManejadorDeEvento = (event: EventoDeIntegracion) => void | Promise<void>;

/** Cancela la suscripción que la devolvió. */
export type Desuscribir = () => void;

/**
 * Puerto del bus de eventos. Quien publica no sabe quién escucha.
 * La clave tiene la forma `Tipo.vN` (ver `claveDeEvento` en contracts).
 */
export interface BusDeEventos {
  publicar(event: EventoDeIntegracion): Promise<void>;
  /**
   * @param nombre Identifica al manejador de forma estable (`reports.aplicar-decision`): con él,
   * la entrega fiable recuerda qué eventos ya procesó y no se los vuelve a entregar.
   */
  suscribir(key: string, nombre: string, handler: ManejadorDeEvento): Desuscribir;
}
