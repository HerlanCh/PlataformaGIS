import type { CodigoCategoria, IdReporte, PuntoGeo } from '@gis/shared-kernel';
import type { EstadoReporte } from './report.js';

/**
 * Lo que el público puede ver de un reporte. Es una proyección de solo lectura: lleva la
 * ubicación pública y nunca la real ni el autor (RNF-14).
 */
export interface ReportePublico {
  readonly id: IdReporte;
  readonly codigoCategoria: CodigoCategoria;
  readonly estado: EstadoReporte;
  readonly publicLocation: PuntoGeo;
  readonly creadoEn: Date;
  readonly caducaEn: Date;
}
