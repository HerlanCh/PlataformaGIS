import { ErrorValidacionFallida } from '@gis/shared-kernel';
import { z } from 'zod';
import { claveDeEvento } from './integration-event.js';
import type { EventoDeIntegracion } from './integration-event.js';

/** Lo que hace falta de una definición de evento para crearlo o leerlo. */
interface EventoDefinido<Contenido extends z.ZodType> {
  readonly tipo: string;
  readonly version: number;
  readonly clave: string;
  readonly contenido: Contenido;
}

export interface SobreDeEvento {
  readonly id: string;
  readonly ocurridoEn: Date;
}

/**
 * Arma un evento de integración y valida su contenido contra el contrato: un evento
 * mal formado nunca llega al outbox.
 */
export function crearEvento<Contenido extends z.ZodType>(
  definicion: EventoDefinido<Contenido>,
  contenido: z.input<Contenido>,
  sobre: SobreDeEvento,
): EventoDeIntegracion {
  return {
    id: z.uuid().parse(sobre.id),
    tipo: definicion.tipo,
    version: definicion.version,
    ocurridoEn: sobre.ocurridoEn.toISOString(),
    contenido: definicion.contenido.parse(contenido),
  };
}

/**
 * Contenido tipado de un evento recibido.
 * @throws {Error} si el evento no es de esta definición.
 * @throws {z.ZodError} si su contenido no cumple el contrato.
 */
export function leerContenido<Contenido extends z.ZodType>(
  definicion: EventoDefinido<Contenido>,
  evento: EventoDeIntegracion,
): z.output<Contenido> {
  if (claveDeEvento(evento) !== definicion.clave) {
    throw new Error(`Se esperaba ${definicion.clave} y llegó ${claveDeEvento(evento)}`);
  }
  return definicion.contenido.parse(evento.contenido);
}

/**
 * Valida la entrada de un caso de uso.
 * @throws {ErrorValidacionFallida} con el detalle de cada campo inválido.
 */
export function validarEntrada<Esquema extends z.ZodType>(
  esquema: Esquema,
  entrada: unknown,
): z.output<Esquema> {
  const resultado = esquema.safeParse(entrada);
  if (!resultado.success) {
    throw new ErrorValidacionFallida('ENTRADA_INVALIDA', z.prettifyError(resultado.error));
  }
  return resultado.data;
}
