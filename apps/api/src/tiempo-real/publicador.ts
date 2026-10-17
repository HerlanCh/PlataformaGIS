import { claveDeEvento, eventosDeIntegracion, reporteCreadoV1 } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { BusDeEventos } from '@gis/event-bus';
import { PuntoGeo } from '@gis/shared-kernel';
import type { TiempoReal } from './servidor.js';

/** Ubicación pública de un reporte, o `null` si no existe. Nunca la real. */
export type UbicacionPublicaDe = (idReporte: string) => Promise<PuntoGeo | null>;

/** Claves de los eventos que pueden llegar a los clientes. */
export const CLAVES_PUBLICAS = eventosDeIntegracion
  .filter((definicion) => definicion.audiencia === 'publico')
  .map((definicion) => definicion.clave);

export const NOMBRE_DEL_PUBLICADOR = 'tiempo-real';

/**
 * Manejador que difunde por Socket.io los eventos públicos a la celda de su reporte. `ReporteCreado`
 * ya trae la ubicación pública; para los demás se consulta.
 */
export function crearPublicador(
  tiempoReal: Pick<TiempoReal, 'difundir'>,
  ubicacionDe: UbicacionPublicaDe,
) {
  return async (evento: EventoDeIntegracion): Promise<void> => {
    const contenido = evento.contenido as { idReporte: string; publicLocation?: unknown };
    const punto =
      claveDeEvento(evento) === reporteCreadoV1.clave
        ? aPunto(reporteCreadoV1.contenido.parse(evento.contenido).publicLocation)
        : await ubicacionDe(contenido.idReporte);
    if (punto) tiempoReal.difundir(evento, punto);
  };
}

const aPunto = ({ latitud, longitud }: { latitud: number; longitud: number }): PuntoGeo =>
  PuntoGeo.crear(latitud, longitud);

/** Suscribe el publicador a todos los eventos públicos. */
export function suscribirPublicador(
  bus: BusDeEventos,
  tiempoReal: Pick<TiempoReal, 'difundir'>,
  ubicacionDe: UbicacionPublicaDe,
): void {
  const publicar = crearPublicador(tiempoReal, ubicacionDe);
  for (const clave of CLAVES_PUBLICAS) bus.suscribir(clave, NOMBRE_DEL_PUBLICADOR, publicar);
}
