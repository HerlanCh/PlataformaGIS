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
  suscribir(key: string, handler: ManejadorDeEvento): Desuscribir;
}
