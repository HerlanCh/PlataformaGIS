import type { FilaPublica, RepositorioDeDatosAbiertos, Resumen } from '../domain/ports.js';

/** Columnas del CSV, en orden. Ninguna identifica a un usuario ni un punto exacto (HU-11). */
export const COLUMNAS_CSV = [
  'categoria',
  'celda_latitud',
  'celda_longitud',
  'hora_utc',
  'estado_final',
  'fue_confirmado',
] as const;

const fila = (dato: FilaPublica): string =>
  [
    dato.codigoCategoria,
    dato.celda.latitud,
    dato.celda.longitud,
    dato.hora.toISOString(),
    dato.estadoFinal,
    dato.fueConfirmado,
  ].join(',');

/** CSV (RFC 4180) con encabezado. Los valores son códigos y números: no necesitan comillas. */
export const aCsv = (datos: readonly FilaPublica[]): string =>
  [COLUMNAS_CSV.join(','), ...datos.map(fila)].join('\r\n') + '\r\n';

/** HU-11: exportación y resumen de los datos abiertos. Públicos: no exigen cuenta. */
export class ConsultarDatosAbiertos {
  constructor(private readonly datos: RepositorioDeDatosAbiertos) {}

  async exportarCsv(): Promise<string> {
    return aCsv(await this.datos.listar());
  }

  resumir(): Promise<Resumen> {
    return this.datos.resumir();
  }
}
