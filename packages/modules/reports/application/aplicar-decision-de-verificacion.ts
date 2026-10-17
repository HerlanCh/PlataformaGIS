import { leerContenido, votoEmitidoV1 } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { Reporte } from '../domain/report.js';
import { aplicarTransicion } from './aplicar-transicion.js';
import type { DependenciasDeTransicion } from './aplicar-transicion.js';

type Decision = 'CONFIRMAR' | 'EXTENDER' | 'RESOLVER';

const CAMBIOS: Record<Decision, (reporte: Reporte, ahora: Date) => void> = {
  CONFIRMAR: (reporte, ahora) => reporte.marcarConfirmado(ahora),
  EXTENDER: (reporte, ahora) => reporte.extenderCaducidad(ahora),
  RESOLVER: (reporte, ahora) => reporte.marcarResuelto(ahora),
};

/**
 * Manejador de `VotoEmitido.v1` (HU-03): aplica al reporte la decisión de `verification`.
 * Emite `ReporteConfirmado`, `ReporteExtendido` o `ReporteResuelto`.
 */
export class AplicarDecisionDeVerificacion {
  constructor(private readonly deps: DependenciasDeTransicion) {}

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    const { idReporte, decision } = leerContenido(votoEmitidoV1, evento);
    if (decision === 'NINGUNA') return;
    await aplicarTransicion(this.deps, idReporte, CAMBIOS[decision]);
  }
}
