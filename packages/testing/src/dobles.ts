import type {
  ConsumoDeLimite,
  GeneradorDeId,
  LimitadorDeFrecuencia,
  Reloj,
} from '@gis/shared-kernel';

/** Reloj controlable: empieza en la fecha dada y solo avanza cuando la prueba lo pide. */
export class RelojFijo implements Reloj {
  private actual: Date;

  constructor(inicio: Date | string = '2026-10-12T12:00:00Z') {
    this.actual = new Date(inicio);
  }

  ahora(): Date {
    return new Date(this.actual);
  }

  avanzarMinutos(minutos: number): void {
    this.actual = new Date(this.actual.getTime() + minutos * 60_000);
  }
}

/** UUID válidos y predecibles: `00000000-0000-4000-8000-000000000001`, `...002`, etc. */
export class GeneradorDeIdSecuencial implements GeneradorDeId {
  private contador = 0;

  constructor(private readonly prefijo = '00000000') {}

  siguiente(): string {
    this.contador += 1;
    return `${this.prefijo}-0000-4000-8000-${String(this.contador).padStart(12, '0')}`;
  }
}

/** Límite de ventana deslizante en memoria, gobernado por el reloj de la prueba. */
export class LimitadorEnMemoria implements LimitadorDeFrecuencia {
  private readonly consumos = new Map<string, number[]>();

  constructor(private readonly reloj: Reloj) {}

  consumir(clave: string, limite: number, ventanaSegundos: number): Promise<ConsumoDeLimite> {
    const ahora = this.reloj.ahora().getTime();
    const ventanaMs = ventanaSegundos * 1000;
    const vigentes = (this.consumos.get(clave) ?? []).filter(
      (instante) => instante > ahora - ventanaMs,
    );

    if (vigentes.length >= limite) {
      const reintentar = Math.ceil((vigentes[0]! + ventanaMs - ahora) / 1000);
      this.consumos.set(clave, vigentes);
      return Promise.resolve({ permitido: false, reintentarEnSegundos: reintentar });
    }
    this.consumos.set(clave, [...vigentes, ahora]);
    return Promise.resolve({ permitido: true, reintentarEnSegundos: 0 });
  }
}
