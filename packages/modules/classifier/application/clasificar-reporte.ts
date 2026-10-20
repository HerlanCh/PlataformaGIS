import {
  crearEvento,
  descripcionAgregadaV1,
  leerContenido,
  reporteClasificadoV1,
  reporteCreadoV1,
} from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import { idReporte } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
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
 * emite `ReporteClasificado.v1`, que `moderation` usa para marcarlo en su cola.
 */
export class ClasificarReporte {
  static readonly eventos = [reporteCreadoV1.clave, descripcionAgregadaV1.clave] as const;

  constructor(private readonly deps: DependenciasClasificarReporte) {}

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    const definicion =
      evento.tipo === reporteCreadoV1.tipo ? reporteCreadoV1 : descripcionAgregadaV1;
    const id = idReporte(leerContenido(definicion, evento).idReporte);
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
}
