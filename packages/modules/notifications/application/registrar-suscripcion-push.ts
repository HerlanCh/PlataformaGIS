import { validarEntrada } from '@gis/contracts';
import { aErrorDeAplicacion, idUsuario } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeSuscripcionesPush } from '../domain/ports.js';
import { idSuscripcionPush, SuscripcionPush } from '../domain/suscripcion-push.js';

const esquemaEntrada = z.object({
  idUsuario: z.uuid(),
  endpoint: z.string(),
  p256dh: z.string(),
  auth: z.string(),
});

export type EntradaRegistrarSuscripcionPush = z.input<typeof esquemaEntrada>;

export interface DependenciasRegistrarSuscripcionPush {
  readonly suscripciones: RepositorioDeSuscripcionesPush;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/**
 * HU-08: guarda a dónde enviar los avisos de este dispositivo. Es idempotente por endpoint: si
 * el navegador vuelve a enviar la misma suscripción, se reemplaza y queda a nombre del usuario
 * actual (un dispositivo puede registrarse de nuevo con otra identidad).
 */
export class RegistrarSuscripcionPush {
  constructor(private readonly deps: DependenciasRegistrarSuscripcionPush) {}

  async ejecutar(entrada: EntradaRegistrarSuscripcionPush): Promise<SuscripcionPush> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    let suscripcion: SuscripcionPush;
    try {
      suscripcion = SuscripcionPush.crear({
        id: idSuscripcionPush(this.deps.ids.siguiente()),
        idUsuario: idUsuario(datos.idUsuario),
        endpoint: datos.endpoint,
        p256dh: datos.p256dh,
        auth: datos.auth,
        creadoEn: this.deps.reloj.ahora(),
      });
    } catch (error) {
      throw aErrorDeAplicacion(error, { SUSCRIPCION_PUSH_INVALIDA: 'VALIDACION_FALLIDA' });
    }
    await this.deps.suscripciones.guardar(suscripcion);
    return suscripcion;
  }
}
