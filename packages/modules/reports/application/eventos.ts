import {
  crearEvento,
  descripcionAgregadaV1,
  reporteCaducadoV1,
  reporteConfirmadoV1,
  reporteCreadoV1,
  reporteExtendidoV1,
  reporteRechazadoV1,
  reporteResueltoV1,
} from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { GeneradorDeId } from '@gis/shared-kernel';
import type { EventoReporte, Reporte } from '../domain/report.js';

function traducir(
  reporte: Reporte,
  evento: EventoReporte,
  ids: GeneradorDeId,
): EventoDeIntegracion {
  const sobre = { id: ids.siguiente(), ocurridoEn: evento.ocurridoEn };
  const idReporte = reporte.id;
  switch (evento.tipo) {
    case 'ReporteCreado':
      return crearEvento(
        reporteCreadoV1,
        {
          idReporte,
          codigoCategoria: reporte.codigoCategoria,
          // Solo la ubicación pública: este evento llega a los clientes.
          publicLocation: {
            latitud: reporte.publicLocation.latitud,
            longitud: reporte.publicLocation.longitud,
          },
          estado: reporte.estado,
          creadoEn: reporte.creadoEn.toISOString(),
          caducaEn: reporte.caducaEn.toISOString(),
        },
        sobre,
      );
    case 'ReporteConfirmado':
      return crearEvento(
        reporteConfirmadoV1,
        { idReporte, caducaEn: evento.caducaEn.toISOString() },
        sobre,
      );
    case 'ReporteExtendido':
      return crearEvento(
        reporteExtendidoV1,
        { idReporte, caducaEn: evento.caducaEn.toISOString() },
        sobre,
      );
    case 'ReporteResuelto':
      return crearEvento(reporteResueltoV1, { idReporte }, sobre);
    case 'ReporteCaducado':
      return crearEvento(reporteCaducadoV1, { idReporte }, sobre);
    case 'ReporteRechazado':
      return crearEvento(reporteRechazadoV1, { idReporte, motivo: evento.motivo }, sobre);
    case 'DescripcionAgregada':
      return crearEvento(descripcionAgregadaV1, { idReporte }, sobre);
  }
}

/** Saca los eventos pendientes del agregado y los convierte en eventos de integración. */
export const eventosDeIntegracionDe = (
  reporte: Reporte,
  ids: GeneradorDeId,
): EventoDeIntegracion[] =>
  reporte.extraerEventos().map((evento) => traducir(reporte, evento, ids));
