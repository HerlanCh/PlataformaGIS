import {
  CLAVES_REPORTE_CREADO,
  claveDeEvento,
  leerContenido,
  leerReporteCreado,
  reporteCaducadoV1,
  reporteConfirmadoV1,
  reporteDuplicadoDetectadoV1,
  reporteRechazadoV1,
  reporteResueltoV1,
  votoEmitidoV1,
} from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { Cierre } from '../domain/metricas.js';
import type { RepositorioDeMetricas } from '../domain/ports.js';

const CIERRES_POR_EVENTO: ReadonlyMap<string, Cierre> = new Map([
  [reporteCaducadoV1.clave, 'CADUCIDAD'],
  [reporteResueltoV1.clave, 'VOTOS'],
  [reporteRechazadoV1.clave, 'MODERACION'],
]);

/**
 * Fase 13: sigue el ciclo de vida de cada reporte para las métricas del piloto. Usa la hora del
 * evento, no la de su proceso, así un evento que llega tarde por el outbox no altera los tiempos.
 * Lee solo identificadores y estados: nunca guarda quién reportó o votó.
 */
export class RegistrarEventoDeReporte {
  static readonly eventos = [
    ...CLAVES_REPORTE_CREADO,
    votoEmitidoV1.clave,
    reporteDuplicadoDetectadoV1.clave,
    reporteConfirmadoV1.clave,
    ...CIERRES_POR_EVENTO.keys(),
  ];

  constructor(private readonly metricas: RepositorioDeMetricas) {}

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    const clave = claveDeEvento(evento);
    const en = new Date(evento.ocurridoEn);
    const cierre = CIERRES_POR_EVENTO.get(clave);
    if (cierre) {
      const { idReporte } = evento.contenido as { idReporte: string };
      return this.metricas.marcarCierre(idReporte, cierre, en);
    }
    switch (clave) {
      case votoEmitidoV1.clave: {
        const voto = leerContenido(votoEmitidoV1, evento);
        if (voto.valor === 'CONFIRMACION') {
          await this.metricas.marcarPrimeraConfirmacion(voto.idReporte, en);
        }
        return;
      }
      case reporteDuplicadoDetectadoV1.clave: {
        const { idReporteExistente } = leerContenido(reporteDuplicadoDetectadoV1, evento);
        return this.metricas.marcarPrimeraConfirmacion(idReporteExistente, en);
      }
      case reporteConfirmadoV1.clave: {
        const { idReporte } = leerContenido(reporteConfirmadoV1, evento);
        return this.metricas.marcarConfirmado(idReporte, en);
      }
      default:
        return this.alCrear(evento);
    }
  }

  private alCrear(evento: EventoDeIntegracion): Promise<void> {
    const creado = leerReporteCreado(evento);
    return this.metricas.registrarCreacion({
      idReporte: creado.idReporte,
      codigoCategoria: creado.codigoCategoria,
      esOficial: creado.fuenteOficial !== null,
      creadoEn: new Date(creado.creadoEn),
      primeraConfirmacionEn: null,
      confirmadoEn: null,
      cierre: null,
      cerradoEn: null,
    });
  }
}
