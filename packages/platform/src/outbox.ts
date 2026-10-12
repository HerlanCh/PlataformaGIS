import { claveDeEvento } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { Ejecutor } from './database.js';
import { eventosSalida } from './schema.js';

/**
 * Guarda eventos de integración en el outbox. Debe llamarse con la misma transacción
 * que guarda el agregado: o se guardan ambos o ninguno.
 */
export async function agregarASalida(
  ejecutor: Ejecutor,
  eventos: readonly EventoDeIntegracion[],
): Promise<void> {
  if (eventos.length === 0) return;
  await ejecutor.insert(eventosSalida).values(
    eventos.map((evento) => ({
      id: evento.id,
      tipo: claveDeEvento(evento),
      contenido: evento,
      creadoEn: new Date(evento.ocurridoEn),
    })),
  );
}
