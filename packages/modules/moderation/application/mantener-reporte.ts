import { validarEntrada } from '@gis/contracts';
import { idReporte, idUsuario } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import { AccionDeModeracion } from '../domain/accion-de-moderacion.js';
import type { IdAccionDeModeracion } from '../domain/accion-de-moderacion.js';
import type { ConsultaDeReporte } from '../domain/ports.js';
import { asegurarVigente, esquemaRol, exigirModerador } from './comun.js';
import type { UnidadDeTrabajoDeModeracion } from './ports.js';

const esquemaEntrada = z.object({
  idReporte: z.uuid(),
  idModerador: z.uuid(),
  rolActor: esquemaRol,
  motivo: z.string().nullish(),
});

export type EntradaMantenerReporte = z.input<typeof esquemaEntrada>;

export interface DependenciasMantenerReporte {
  readonly consultaDeReporte: ConsultaDeReporte;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeModeracion;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/**
 * HU-12: el moderador revisó un reporte de la cola y lo deja publicado. Queda en la auditoría y
 * sale de la cola; si recibe negaciones o marcas nuevas, vuelve a entrar.
 */
export class MantenerReporte {
  constructor(private readonly deps: DependenciasMantenerReporte) {}

  async ejecutar(entrada: EntradaMantenerReporte): Promise<void> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    exigirModerador(datos.rolActor);
    const id = idReporte(datos.idReporte);
    await asegurarVigente(this.deps.consultaDeReporte, id);

    const accion = AccionDeModeracion.mantener({
      id: this.deps.ids.siguiente() as IdAccionDeModeracion,
      idReporte: id,
      idModerador: idUsuario(datos.idModerador),
      motivo: datos.motivo ?? null,
      ahora: this.deps.reloj.ahora(),
    });
    await this.deps.unidadDeTrabajo.registrar(accion, []);
  }
}
