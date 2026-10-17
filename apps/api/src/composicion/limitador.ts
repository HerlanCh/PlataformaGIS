import type { ConsumoDeLimite, LimitadorDeFrecuencia, Reloj } from '@gis/shared-kernel';

/** Cada cuántos consumos se descartan las claves que ya no tienen solicitudes vigentes. */
const CONSUMOS_ENTRE_LIMPIEZAS = 1000;

/**
 * Adaptador de `LimitadorDeFrecuencia` en la memoria del proceso, con ventana deslizante.
 * Basta mientras la API corra en una sola instancia; con varias haría falta un almacén común.
 */
export class LimitadorDeFrecuenciaEnProceso implements LimitadorDeFrecuencia {
  private readonly instantesPorClave = new Map<string, number[]>();
  private consumos = 0;

  constructor(private readonly reloj: Reloj) {}

  consumir(clave: string, limite: number, ventanaSegundos: number): Promise<ConsumoDeLimite> {
    const ahora = this.reloj.ahora().getTime();
    const desde = ahora - ventanaSegundos * 1000;
    this.limpiarDeVezEnCuando(desde);

    const instantes = this.instantesPorClave.get(clave) ?? [];
    while (instantes.length > 0 && instantes[0]! <= desde) instantes.shift();

    const permitido = instantes.length < limite;
    if (permitido) instantes.push(ahora);
    this.instantesPorClave.set(clave, instantes);
    // Se libera un cupo cuando sale de la ventana el consumo más antiguo.
    const reintentarEnSegundos = permitido ? 0 : Math.ceil((instantes[0]! - desde) / 1000);
    return Promise.resolve({ permitido, reintentarEnSegundos });
  }

  private limpiarDeVezEnCuando(desde: number): void {
    this.consumos += 1;
    if (this.consumos % CONSUMOS_ENTRE_LIMPIEZAS !== 0) return;
    for (const [clave, instantes] of this.instantesPorClave) {
      if (instantes.every((instante) => instante <= desde)) this.instantesPorClave.delete(clave);
    }
  }
}
