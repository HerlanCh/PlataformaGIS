import { validarEntrada } from '@gis/contracts';
import { aErrorDeAplicacion, ErrorNoEncontrado, idReporte, idUsuario } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeReportes } from '../domain/ports.js';
import { eventosDeIntegracionDe } from './eventos.js';
import type { UnidadDeTrabajoDeReporte } from './ports.js';

const esquemaEntrada = z.object({
  idReporte: z.uuid(),
  idAutor: z.uuid(),
  descripcion: z.string(),
});

export type EntradaAgregarDescripcion = z.input<typeof esquemaEntrada>;

export interface DependenciasAgregarDescripcion {
  readonly reportes: RepositorioDeReportes;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeReporte;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/**
 * El autor añade una descripción privada a su reporte, después de crearlo. Se guarda con
 * `DescripcionAgregada.v1`, que lleva al clasificador a revisarla (HU-10).
 */
export class AgregarDescripcion {
  constructor(private readonly deps: DependenciasAgregarDescripcion) {}

  async ejecutar(entrada: EntradaAgregarDescripcion): Promise<void> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    const reporte = await this.deps.reportes.buscarPorId(idReporte(datos.idReporte));
    if (!reporte) throw new ErrorNoEncontrado('REPORTE_NO_ENCONTRADO', 'El reporte no existe');
    const idAutor = idUsuario(datos.idAutor);

    // SRS 3.2.7: el autor silenciado ve su reporte `ACTIVO`; se acepta sin guardar para no delatarlo.
    if (reporte.motivoRechazo === 'AUTOR_SILENCIADO' && reporte.authorId === idAutor) return;

    try {
      reporte.agregarDescripcion(datos.descripcion, idAutor, this.deps.reloj.ahora());
    } catch (error) {
      throw aErrorDeAplicacion(error, {
        NO_ES_EL_AUTOR: 'PROHIBIDO',
        REPORTE_NO_VIGENTE: 'CONFLICTO',
        DESCRIPCION_YA_AGREGADA: 'CONFLICTO',
        DESCRIPCION_INVALIDA: 'VALIDACION_FALLIDA',
      });
    }
    await this.deps.unidadDeTrabajo.confirmar(
      reporte,
      eventosDeIntegracionDe(reporte, this.deps.ids),
    );
  }
}
