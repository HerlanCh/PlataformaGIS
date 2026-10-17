import { leerContenido, rechazoDeModeracionV1 } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import { aplicarTransicion } from './aplicar-transicion.js';
import type { DependenciasDeTransicion } from './aplicar-transicion.js';

/** Manejador de `RechazoDeModeracion.v1` (HU-12): rechaza el reporte y emite `ReporteRechazado.v1`. */
export class AplicarRechazoDeModeracion {
  constructor(private readonly deps: DependenciasDeTransicion) {}

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    const { idReporte } = leerContenido(rechazoDeModeracionV1, evento);
    await aplicarTransicion(this.deps, idReporte, (reporte, ahora) =>
      reporte.rechazar('MODERACION', ahora),
    );
  }
}
