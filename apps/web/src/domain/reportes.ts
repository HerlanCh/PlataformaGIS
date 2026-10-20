import type { ReportePublico } from '@gis/api-client';
import { dentroDe } from './geo.js';
import type { Caja, Punto } from './geo.js';

export type { ReportePublico };

/** Evento público que llega por el tiempo real (`evento`). Solo lleva datos públicos. */
export interface EventoPublico {
  readonly id: string;
  readonly tipo: string;
  readonly version: number;
  readonly ocurridoEn: string;
  readonly contenido: { readonly idReporte: string } & Record<string, unknown>;
}

const SALEN_DEL_MAPA = new Set(['ReporteResuelto', 'ReporteCaducado', 'ReporteRechazado']);

/**
 * Aplica un evento a la lista de reportes visibles de una ventana. Es pura: devuelve la misma
 * lista si el evento no la cambia, para que la caché no vuelva a pintar el mapa sin motivo.
 */
export function aplicarEvento(
  lista: readonly ReportePublico[],
  evento: EventoPublico,
  ventana: Caja,
): readonly ReportePublico[] {
  const { idReporte } = evento.contenido;
  const existe = lista.some((r) => r.id === idReporte);

  if (evento.tipo === 'ReporteCreado') {
    const nuevo = evento.contenido as unknown as ReportePublico & { idReporte: string };
    if (existe || !dentroDe(nuevo.publicLocation, ventana)) return lista;
    const reporte: ReportePublico = {
      id: idReporte,
      codigoCategoria: nuevo.codigoCategoria,
      estado: nuevo.estado,
      publicLocation: nuevo.publicLocation,
      creadoEn: nuevo.creadoEn,
      caducaEn: nuevo.caducaEn,
    };
    return [reporte, ...lista];
  }
  if (!existe) return lista;
  if (SALEN_DEL_MAPA.has(evento.tipo)) return lista.filter((r) => r.id !== idReporte);

  const caducaEn = evento.contenido.caducaEn;
  if (evento.tipo === 'ReporteConfirmado' || evento.tipo === 'ReporteExtendido') {
    return lista.map((r) =>
      r.id === idReporte
        ? {
            ...r,
            estado: 'CONFIRMADO',
            caducaEn: typeof caducaEn === 'string' ? caducaEn : r.caducaEn,
          }
        : r,
    );
  }
  return lista;
}

/** Hora de vencimiento en la hora de Bolivia: "18:40". */
export const horaDe = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/La_Paz',
  });

const diaEnLaPaz = (fecha: Date): string =>
  fecha.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });

/** Hasta cuándo sigue vigente, dicho sin ambigüedad: "18:40", "mañana 09:10" o "20/10 09:10". */
export function vigenciaDe(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  const hora = horaDe(iso);
  if (diaEnLaPaz(fecha) === diaEnLaPaz(ahora)) return hora;
  const manana = new Date(ahora.getTime() + 86_400_000);
  if (diaEnLaPaz(fecha) === diaEnLaPaz(manana)) return `mañana ${hora}`;
  const dia = fecha.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/La_Paz',
  });
  return `${dia} ${hora}`;
}

/** Enlace que abre la app en un reporte: el mapa va a su ubicación pública y abre su detalle. */
export function enlaceAlReporte(idReporte: string, punto: Punto): string {
  const parametros = new URLSearchParams({
    reporte: idReporte,
    lat: String(punto.latitud),
    lon: String(punto.longitud),
  });
  return `/?${parametros.toString()}`;
}
