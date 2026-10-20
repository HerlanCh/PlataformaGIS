import {
  claveDeEvento,
  leerContenido,
  reporteCaducadoV1,
  reporteClasificadoV1,
  reporteRechazadoV1,
  reporteResueltoV1,
  votoEmitidoV1,
} from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import { idReporte } from '@gis/shared-kernel';
import type { IdReporte } from '@gis/shared-kernel';
import { CasoDeModeracion } from '../domain/caso-de-moderacion.js';
import type { RepositorioDeCola } from '../domain/ports.js';

const DESENLACES = [reporteRechazadoV1, reporteResueltoV1, reporteCaducadoV1] as const;

/**
 * Mantiene la cola de moderación con los eventos de otros módulos (HU-12 y HU-10):
 * - `VotoEmitido.v1` con una negación suma una negación;
 * - `ReporteClasificado.v1` sospechoso marca el caso;
 * - el rechazo, la resolución o la caducidad del reporte lo sacan de la cola.
 */
export class ActualizarColaDeModeracion {
  static readonly eventos = [
    votoEmitidoV1.clave,
    reporteClasificadoV1.clave,
    ...DESENLACES.map((d) => d.clave),
  ] as const;

  constructor(private readonly cola: RepositorioDeCola) {}

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    const cuando = new Date(evento.ocurridoEn);
    const clave = claveDeEvento(evento);
    if (clave === votoEmitidoV1.clave) {
      const voto = leerContenido(votoEmitidoV1, evento);
      if (voto.valor !== 'NEGACION') return;
      await this.actualizar(idReporte(voto.idReporte), cuando, (c) => c.registrarNegacion(cuando));
      return;
    }
    if (clave === reporteClasificadoV1.clave) {
      const clasificacion = leerContenido(reporteClasificadoV1, evento);
      if (!clasificacion.sospechoso) return;
      await this.actualizar(idReporte(clasificacion.idReporte), cuando, (c) =>
        c.marcar(clasificacion.motivos, cuando),
      );
      return;
    }
    const desenlace = DESENLACES.find((d) => d.clave === clave);
    if (desenlace)
      await this.resolver(idReporte(leerContenido(desenlace, evento).idReporte), cuando);
  }

  private async actualizar(
    id: IdReporte,
    cuando: Date,
    cambio: (caso: CasoDeModeracion) => void,
  ): Promise<void> {
    const caso = (await this.cola.buscar(id)) ?? CasoDeModeracion.abrir(id, cuando);
    cambio(caso);
    await this.cola.guardar(caso);
  }

  private async resolver(id: IdReporte, cuando: Date): Promise<void> {
    const caso = await this.cola.buscar(id);
    if (!caso) return;
    caso.resolver(cuando);
    await this.cola.guardar(caso);
  }
}
