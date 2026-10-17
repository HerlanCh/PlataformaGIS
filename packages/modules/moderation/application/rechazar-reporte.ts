import { crearEvento, rechazoDeModeracionV1, validarEntrada } from '@gis/contracts';
import {
  aErrorDeAplicacion,
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorProhibido,
  idReporte,
  idUsuario,
} from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import { AccionDeModeracion } from '../domain/accion-de-moderacion.js';
import type { IdAccionDeModeracion } from '../domain/accion-de-moderacion.js';
import type { ConsultaDeReporte } from '../domain/ports.js';
import type { UnidadDeTrabajoDeModeracion } from './ports.js';

const esquemaEntrada = z.object({
  idReporte: z.uuid(),
  idModerador: z.uuid(),
  /** Rol del actor según su credencial (Fase 6). */
  rolActor: z.enum(['CIUDADANO', 'MODERADOR']),
  motivo: z.string(),
});

export type EntradaRechazarReporte = z.input<typeof esquemaEntrada>;

export interface DependenciasRechazarReporte {
  readonly consultaDeReporte: ConsultaDeReporte;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeModeracion;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/**
 * HU-12: un moderador rechaza un reporte vigente con su motivo. Se guardan la auditoría y
 * `RechazoDeModeracion.v1`; después `reports` cambia el estado y emite `ReporteRechazado.v1`,
 * y `verification` resta 0,50 al autor.
 */
export class RechazarReporte {
  constructor(private readonly deps: DependenciasRechazarReporte) {}

  async ejecutar(entrada: EntradaRechazarReporte): Promise<void> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    if (datos.rolActor !== 'MODERADOR') {
      throw new ErrorProhibido('ROL_INSUFICIENTE', 'Solo un moderador puede rechazar reportes');
    }
    const id = idReporte(datos.idReporte);
    const estado = await this.deps.consultaDeReporte.estadoDe(id);
    if (estado === null)
      throw new ErrorNoEncontrado('REPORTE_NO_ENCONTRADO', 'El reporte no existe');
    if (estado !== 'ACTIVO' && estado !== 'CONFIRMADO') {
      throw new ErrorConflicto(
        'REPORTE_NO_VIGENTE',
        `Un reporte ${estado} ya no se puede rechazar`,
      );
    }

    const ahora = this.deps.reloj.ahora();
    const idModerador = idUsuario(datos.idModerador);
    let accion: AccionDeModeracion;
    try {
      accion = AccionDeModeracion.rechazo({
        id: this.deps.ids.siguiente() as IdAccionDeModeracion,
        idReporte: id,
        idModerador,
        motivo: datos.motivo,
        ahora,
      });
    } catch (error) {
      throw aErrorDeAplicacion(error, { MOTIVO_OBLIGATORIO: 'VALIDACION_FALLIDA' });
    }
    const evento = crearEvento(
      rechazoDeModeracionV1,
      { idReporte: id, idModerador },
      { id: this.deps.ids.siguiente(), ocurridoEn: ahora },
    );
    await this.deps.unidadDeTrabajo.registrar(accion, [evento]);
  }
}
