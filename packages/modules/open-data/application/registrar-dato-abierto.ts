import { createHash } from 'node:crypto';
import {
  claveDeEvento,
  leerContenido,
  reporteCaducadoV1,
  reporteRechazadoV1,
  reporteResueltoV1,
} from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import { anonimizar, esPublicable } from '../domain/dato-abierto.js';
import type { ConsultaDeReportesFinalizados, RepositorioDeDatosAbiertos } from '../domain/ports.js';

const DESENLACES = [reporteResueltoV1, reporteCaducadoV1, reporteRechazadoV1] as const;

/** SHA-256 del ID: evita registrar dos veces el mismo reporte sin publicar su ID. */
export const huellaDe = (idReporte: string): string =>
  createHash('sha256').update(idReporte).digest('hex');

/**
 * HU-11: cuando un reporte termina (resuelto, caducado o rechazado), guarda su fila anonimizada.
 * Es idempotente: un evento repetido o la carga del histórico no la duplican.
 */
export class RegistrarDatoAbierto {
  static readonly eventos = DESENLACES.map((d) => d.clave);

  constructor(
    private readonly reportes: ConsultaDeReportesFinalizados,
    private readonly datos: RepositorioDeDatosAbiertos,
  ) {}

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    const desenlace = DESENLACES.find((d) => d.clave === claveDeEvento(evento));
    if (desenlace) await this.registrar(leerContenido(desenlace, evento).idReporte);
  }

  /** Devuelve si se agregó una fila nueva. */
  async registrar(idReporte: string): Promise<boolean> {
    const reporte = await this.reportes.buscar(idReporte);
    if (!reporte || !esPublicable(reporte)) return false;
    return this.datos.guardar(anonimizar(reporte, huellaDe(idReporte)));
  }
}
