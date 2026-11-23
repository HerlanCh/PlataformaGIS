import type { Envio, EstadoRegistrado, Transicion, UbicacionPublica } from './registro.js';

/** La vista base muestra cada envío de las últimas 24 h (ADR-007). */
export const VENTANA_BASE_MS = 24 * 60 * 60 * 1000;

export interface Caja {
  readonly latitudMin: number;
  readonly latitudMax: number;
  readonly longitudMin: number;
  readonly longitudMax: number;
}

/** Un reporte que el mapa mostraba en el instante, con su estado. */
export interface PuntoProcesado {
  readonly idReporte: string;
  readonly codigoCategoria: string;
  readonly publicLocation: UbicacionPublica;
  readonly estado: 'ACTIVO' | 'CONFIRMADO';
  readonly caducaEn: Date;
  readonly fuenteOficial: string | null;
}

/** Un envío como punto propio: sin estado ni caducidad. */
export interface PuntoBase {
  readonly idEnvio: string;
  readonly idReporte: string;
  readonly codigoCategoria: string;
  readonly publicLocation: UbicacionPublica;
  readonly recibidoEn: Date;
  readonly fuenteOficial: string | null;
}

export interface Vistas {
  readonly instante: Date;
  readonly caja: Caja;
  readonly procesada: readonly PuntoProcesado[];
  readonly base: readonly PuntoBase[];
}

/** Lo que el repositorio entrega para reconstruir las vistas de una zona en un instante. */
export interface RegistroParaVistas {
  readonly envios: readonly Envio[];
  readonly transiciones: readonly Transicion[];
}

interface SituacionDelReporte {
  readonly estado: EstadoRegistrado;
  readonly caducaEn: Date | null;
  readonly rechazado: boolean;
}

const enLaCaja = ({ latitud, longitud }: UbicacionPublica, caja: Caja): boolean =>
  latitud >= caja.latitudMin &&
  latitud <= caja.latitudMax &&
  longitud >= caja.longitudMin &&
  longitud <= caja.longitudMax;

/**
 * Estado de cada reporte en el instante: el de su última transición hasta entonces y la última
 * caducidad que dejó. Las transiciones posteriores al instante no cuentan.
 */
function situaciones(
  transiciones: readonly Transicion[],
  instante: Date,
): ReadonlyMap<string, SituacionDelReporte> {
  const hasta = instante.getTime();
  const ordenadas = transiciones
    .filter((t) => t.ocurridoEn.getTime() <= hasta)
    .toSorted((a, b) => a.ocurridoEn.getTime() - b.ocurridoEn.getTime());
  const resultado = new Map<string, SituacionDelReporte>();
  for (const t of ordenadas) {
    const previa = resultado.get(t.idReporte);
    resultado.set(t.idReporte, {
      estado: t.estado,
      caducaEn: t.caducaEn ?? previa?.caducaEn ?? null,
      rechazado: (previa?.rechazado ?? false) || t.estado === 'RECHAZADO',
    });
  }
  return resultado;
}

/**
 * Vigente como en la consulta del mapa (`ListarReportesEnVentana`): `ACTIVO` o `CONFIRMADO` y con
 * caducidad no anterior al instante (en el instante exacto sigue vigente).
 */
const vigente = (situacion: SituacionDelReporte | undefined, instante: Date): boolean =>
  situacion !== undefined &&
  (situacion.estado === 'ACTIVO' || situacion.estado === 'CONFIRMADO') &&
  situacion.caducaEn !== null &&
  situacion.caducaEn.getTime() >= instante.getTime();

const aPuntoBase = (envio: Envio): PuntoBase => ({
  idEnvio: envio.idEnvio,
  idReporte: envio.idReporte,
  codigoCategoria: envio.codigoCategoria,
  publicLocation: envio.publicLocation,
  recibidoEn: envio.recibidoEn,
  fuenteOficial: envio.fuenteOficial,
});

/** Orden estable para comparar y guardar: la procesada por reporte, la base del más reciente. */
const porReporte = (a: PuntoProcesado, b: PuntoProcesado): number =>
  a.idReporte.localeCompare(b.idReporte);

const porRecepcion = (a: PuntoBase, b: PuntoBase): number =>
  b.recibidoEn.getTime() - a.recibidoEn.getTime() || a.idEnvio.localeCompare(b.idEnvio);

/**
 * ADR-007: las dos vistas de una zona en un instante, desde el registro propio.
 * - **Procesada:** los reportes vigentes en el instante, con su estado; los duplicados, absorbidos.
 * - **Base:** cada envío de la comunidad recibido en `(instante − 24 h, instante]`, como un punto
 *   propio.
 * - **Iguales en ambas:** fuera lo rechazado por moderación desde el rechazo, con los duplicados que
 *   lo confirmaban (la moderación actúa sobre el incidente y protege a terceros); los incidentes
 *   oficiales aparecen en las dos como en el mapa, aunque se hayan publicado hace más de 24 h.
 * Un reporte creado antes de activar el módulo no tiene envío ni ubicación: no aparece.
 */
export function reconstruirVistas(
  registro: RegistroParaVistas,
  instante: Date,
  caja: Caja,
): Vistas {
  const estados = situaciones(registro.transiciones, instante);
  const hasta = instante.getTime();
  const desde = hasta - VENTANA_BASE_MS;
  const envios = registro.envios.filter(
    (e) =>
      e.recibidoEn.getTime() <= hasta &&
      enLaCaja(e.publicLocation, caja) &&
      !(estados.get(e.idReporte)?.rechazado ?? false),
  );

  const procesada: PuntoProcesado[] = envios
    .filter((e) => e.tipo === 'CREADO' && vigente(estados.get(e.idReporte), instante))
    .map((e) => {
      const situacion = estados.get(e.idReporte)!;
      return {
        idReporte: e.idReporte,
        codigoCategoria: e.codigoCategoria,
        publicLocation: e.publicLocation,
        estado: situacion.estado as PuntoProcesado['estado'],
        caducaEn: situacion.caducaEn!,
        fuenteOficial: e.fuenteOficial,
      };
    });

  const oficiales = new Set(
    procesada.filter((p) => p.fuenteOficial !== null).map((p) => p.idReporte),
  );
  const base: PuntoBase[] = envios
    .filter((e) =>
      e.fuenteOficial === null ? e.recibidoEn.getTime() > desde : oficiales.has(e.idReporte),
    )
    .map(aPuntoBase);

  return {
    instante,
    caja,
    procesada: procesada.toSorted(porReporte),
    base: base.toSorted(porRecepcion),
  };
}
