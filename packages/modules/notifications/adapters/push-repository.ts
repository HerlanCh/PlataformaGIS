import type { Ejecutor } from '@gis/platform';
import { idUsuario } from '@gis/shared-kernel';
import type { IdUsuario } from '@gis/shared-kernel';
import { and, asc, eq } from 'drizzle-orm';
import type { RepositorioDeSuscripcionesPush } from '../domain/ports.js';
import { idSuscripcionPush, SuscripcionPush } from '../domain/suscripcion-push.js';
import { suscripcionesPush } from './schema.js';

type Fila = typeof suscripcionesPush.$inferSelect;

/** Mapeo explícito fila → entidad: el dominio nunca ve tipos de Drizzle. */
const aEntidad = (fila: Fila): SuscripcionPush =>
  SuscripcionPush.restaurar({
    id: idSuscripcionPush(fila.id),
    idUsuario: idUsuario(fila.idUsuario),
    endpoint: fila.endpoint,
    p256dh: fila.p256dh,
    auth: fila.auth,
    creadoEn: fila.creadoEn,
  });

export class RepositorioSuscripcionesPushPg implements RepositorioDeSuscripcionesPush {
  constructor(private readonly db: Ejecutor) {}

  async guardar(suscripcion: SuscripcionPush): Promise<void> {
    const valores = {
      idUsuario: suscripcion.idUsuario,
      p256dh: suscripcion.p256dh,
      auth: suscripcion.auth,
      creadoEn: suscripcion.creadoEn,
    };
    await this.db
      .insert(suscripcionesPush)
      .values({ id: suscripcion.id, endpoint: suscripcion.endpoint, ...valores })
      .onConflictDoUpdate({ target: suscripcionesPush.endpoint, set: valores });
  }

  async buscarPorUsuario(id: IdUsuario): Promise<readonly SuscripcionPush[]> {
    const filas = await this.db
      .select()
      .from(suscripcionesPush)
      .where(eq(suscripcionesPush.idUsuario, id))
      .orderBy(asc(suscripcionesPush.creadoEn), asc(suscripcionesPush.id));
    return filas.map(aEntidad);
  }

  async eliminarPorEndpoint(endpoint: string, id?: IdUsuario): Promise<boolean> {
    const condicion = id
      ? and(eq(suscripcionesPush.endpoint, endpoint), eq(suscripcionesPush.idUsuario, id))
      : eq(suscripcionesPush.endpoint, endpoint);
    const borradas = await this.db
      .delete(suscripcionesPush)
      .where(condicion)
      .returning({ id: suscripcionesPush.id });
    return borradas.length > 0;
  }
}
