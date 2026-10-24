import {
  CLAVES_REPORTE_CREADO,
  crearEvento,
  descripcionAgregadaV1,
  leerContenido,
  leerReporteCreado,
  reporteClasificadoV1,
} from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import { idReporte } from '@gis/shared-kernel';
import type { GeneradorDeId, IdReporte, Reloj } from '@gis/shared-kernel';
import type { Clasificador, IdClasificacion } from '../domain/clasificacion.js';
import type { ConsultaParaClasificar, UnidadDeTrabajoDeClasificacion } from './ports.js';

export interface DependenciasClasificarReporte {
  readonly consulta: ConsultaParaClasificar;
  readonly clasificador: Clasificador;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeClasificacion;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/**
 * HU-10: clasifica un reporte después de crearlo y otra vez cuando el autor lo describe. Corre en
 * el bus, tras el outbox: crear un reporte nunca espera al clasificador. Guarda el resultado y
 * emite `ReporteClasificado.v1`, que `moderation` usa para marcarlo en su cola. Los incidentes de
 * fuente oficial (HU-13) no se clasifican: los publica un moderador.
 */
export class ClasificarReporte {
  static readonly eventos = [...CLAVES_REPORTE_CREADO, descripcionAgregadaV1.clave] as const;

  constructor(private readonly deps: DependenciasClasificarReporte) {}

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    const id = this.reporteAClasificar(evento);
    if (!id) return;
    const datos = await this.deps.consulta.datosDe(id);
    if (!datos) return;

    const clasificacion = await this.deps.clasificador.clasificar(datos);
    const ahora = this.deps.reloj.ahora();
    const salida = crearEvento(
      reporteClasificadoV1,
      {
        idReporte: id,
        sospechoso: clasificacion.sospechoso,
        motivos: [...clasificacion.motivos],
        clasificador: clasificacion.clasificador,
      },
      { id: this.deps.ids.siguiente(), ocurridoEn: ahora },
    );
    await this.deps.unidadDeTrabajo.registrar(
      {
        ...clasificacion,
        id: this.deps.ids.siguiente() as IdClasificacion,
        idReporte: id,
        creadoEn: ahora,
      },
      [salida],
    );
  }

  /** El reporte del evento, o `null` si es un incidente oficial. */
  private reporteAClasificar(evento: EventoDeIntegracion): IdReporte | null {
    if (evento.tipo !== descripcionAgregadaV1.tipo) {
      const creado = leerReporteCreado(evento);
      return creado.fuenteOficial === null ? idReporte(creado.idReporte) : null;
    }
    return idReporte(leerContenido(descripcionAgregadaV1, evento).idReporte);
  }
}
