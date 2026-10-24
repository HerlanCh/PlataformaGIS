import { createHmac } from 'node:crypto';
import type { Reloj } from '@gis/shared-kernel';
import { diaEnLaPaz } from '../domain/metricas.js';
import type { RepositorioDeMetricas } from '../domain/ports.js';

/**
 * Huella de una persona en un día: HMAC del día y su ID con una sal secreta. Con el día dentro, las
 * huellas de dos días distintos no se pueden relacionar, y sin la sal no se recupera el ID.
 */
export const huellaDelDia = (sal: string, dia: string, idUsuario: string): string =>
  createHmac('sha256', sal).update(`${dia}:${idUsuario}`).digest('hex');

/**
 * Fase 13: cuenta a quien reporta o vota, sin guardar quién es. Al empezar un día nuevo, los
 * anteriores quedan reducidos a su conteo y sus huellas se borran.
 */
export class RegistrarActividad {
  constructor(
    private readonly metricas: RepositorioDeMetricas,
    private readonly reloj: Reloj,
    private readonly sal: string,
  ) {}

  async ejecutar(idUsuario: string): Promise<void> {
    const dia = diaEnLaPaz(this.reloj.ahora());
    await this.metricas.registrarActividad(dia, huellaDelDia(this.sal, dia, idUsuario));
    await this.metricas.consolidarAntesDe(dia);
  }
}
