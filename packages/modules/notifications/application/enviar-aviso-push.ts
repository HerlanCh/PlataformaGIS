import type { IdUsuario } from '@gis/shared-kernel';
import type { RepositorioDeSuscripcionesPush } from '../domain/ports.js';
import { ErrorSuscripcionVencida } from './ports.js';
import type { ContenidoDeAviso, EmisorPush } from './ports.js';

export interface DependenciasEnviarAvisoPush {
  readonly suscripciones: RepositorioDeSuscripcionesPush;
  readonly emisor: EmisorPush;
}

/** Cómo terminó un aviso: cuántos dispositivos lo recibieron, cuántos vencieron y cuántos fallaron. */
export interface ResultadoDeAviso {
  readonly enviados: number;
  readonly vencidas: number;
  readonly fallidos: number;
}

/**
 * HU-08: envía un aviso a todos los dispositivos de un usuario. Una suscripción vencida (404 o 410
 * del servicio push) se borra. Los demás fallos se cuentan pero no se lanzan: el manejador del
 * evento no debe reintentar, porque repetiría el aviso a quienes sí lo recibieron.
 */
export class EnviarAvisoPush {
  constructor(private readonly deps: DependenciasEnviarAvisoPush) {}

  async ejecutar(idUsuario: IdUsuario, contenido: ContenidoDeAviso): Promise<ResultadoDeAviso> {
    const dispositivos = await this.deps.suscripciones.buscarPorUsuario(idUsuario);
    const envios = await Promise.allSettled(
      dispositivos.map((suscripcion) => this.deps.emisor.enviar(suscripcion, contenido)),
    );

    const vencidas = dispositivos.filter((_, i) => {
      const envio = envios[i]!;
      return envio.status === 'rejected' && envio.reason instanceof ErrorSuscripcionVencida;
    });
    const fallidos = envios.filter((e) => e.status === 'rejected').length - vencidas.length;
    await Promise.all(vencidas.map((s) => this.deps.suscripciones.eliminarPorEndpoint(s.endpoint)));
    return {
      enviados: dispositivos.length - vencidas.length - fallidos,
      vencidas: vencidas.length,
      fallidos,
    };
  }
}
