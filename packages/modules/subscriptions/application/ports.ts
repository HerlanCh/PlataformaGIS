import type { CodigoCategoria, IdReporte, IdUsuario, PuntoGeo } from '@gis/shared-kernel';

/**
 * Puerto propio hacia `reports`: el autor de un reporte, que el evento público no lleva.
 * La raíz de composición lo conecta con la interfaz pública de ese módulo (ADR-001).
 */
export interface ConsultaDeAutor {
  autorDe(idReporte: IdReporte): Promise<IdUsuario | null>;
}

/** Aviso de un reporte nuevo en una zona suscrita. Solo lleva la ubicación pública. */
export interface AvisoDeReporte {
  readonly idUsuario: IdUsuario;
  readonly idReporte: IdReporte;
  readonly codigoCategoria: CodigoCategoria;
  readonly publicLocation: PuntoGeo;
}

/** Canal de salida de los avisos: Web Push y Telegram en las Fases 8 y 9, un registro antes. */
export interface EnviadorDeNotificaciones {
  enviar(aviso: AvisoDeReporte): Promise<void>;
}
