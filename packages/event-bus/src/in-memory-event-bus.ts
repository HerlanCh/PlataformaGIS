import { claveDeEvento } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { BusDeEventos, ManejadorDeEvento, Desuscribir } from './event-bus.js';

export type EscuchaDeErrorDeManejador = (error: unknown, event: EventoDeIntegracion) => void;

/**
 * Bus en memoria para un solo proceso. No sobrevive a un reinicio:
 * la entrega fiable llega con el outbox de la Fase 7.
 */
export class BusDeEventosEnMemoria implements BusDeEventos {
  private readonly manejadores = new Map<string, Set<ManejadorDeEvento>>();

  constructor(private readonly alErrorDeManejador: EscuchaDeErrorDeManejador = () => {}) {}

  suscribir(key: string, handler: ManejadorDeEvento): Desuscribir {
    const registrados = this.manejadores.get(key) ?? new Set<ManejadorDeEvento>();
    registrados.add(handler);
    this.manejadores.set(key, registrados);
    return () => {
      registrados.delete(handler);
    };
  }

  async publicar(event: EventoDeIntegracion): Promise<void> {
    const registrados = [...(this.manejadores.get(claveDeEvento(event)) ?? [])];
    // El fallo de un manejador no impide que los demás reciban el evento.
    const resultados = await Promise.allSettled(registrados.map(async (handler) => handler(event)));
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') this.alErrorDeManejador(resultado.reason, event);
    }
  }
}
