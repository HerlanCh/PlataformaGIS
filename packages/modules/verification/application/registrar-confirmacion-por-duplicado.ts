import { leerContenido, reporteDuplicadoDetectadoV1 } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import { ErrorDeAplicacion, idReporte, idUsuario } from '@gis/shared-kernel';
import { emitirVoto } from './emitir-voto.js';
import type { DependenciasDeVoto } from './emitir-voto.js';

/**
 * Manejador de `ReporteDuplicadoDetectado.v1` (HU-01, escenario 2; SRS 3.2.3): el reporte
 * duplicado cuenta como confirmación de quien lo envió. Es idempotente: si el voto no procede
 * (ya votó, el reporte dejó de estar vigente o no existe), no hace nada.
 */
export class RegistrarConfirmacionPorDuplicado {
  constructor(private readonly deps: DependenciasDeVoto) {}

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    const contenido = leerContenido(reporteDuplicadoDetectadoV1, evento);
    try {
      await emitirVoto(this.deps, {
        idReporte: idReporte(contenido.idReporteExistente),
        idVotante: idUsuario(contenido.idReportante),
        latitud: contenido.ubicacionReportante.latitud,
        longitud: contenido.ubicacionReportante.longitud,
        valor: 'CONFIRMACION',
      });
    } catch (error) {
      // Nadie espera la respuesta de un manejador: un voto que no procede se descarta.
      if (error instanceof ErrorDeAplicacion) return;
      throw error;
    }
  }
}
