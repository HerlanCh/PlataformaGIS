// Prueba de humo tras cada despliegue (roadmap 12): crea un reporte real con el usuario de humo
// (`HUMO_ID_USUARIO`), lo recibe por WebSocket y lo rechaza. Ese reporte no debe tener efectos
// fuera del mapa: no avisa a suscriptores, no entra en los datos abiertos y no cambia la reputación
// del usuario de humo, que si no terminaría silenciado por acumular rechazos.
import type { EventoDeIntegracion } from '@gis/contracts';
import type { RepositorioDeReportes } from '@gis/module-reports';
import { idReporte } from '@gis/shared-kernel';

/** `true` si el reporte lo creó el usuario de humo. */
export type EsDeHumo = (idReporte: string) => Promise<boolean>;

export const reportesDeHumo =
  (
    reportes: Pick<RepositorioDeReportes, 'buscarPorId'>,
    idUsuarioDeHumo: string | null = null,
  ): EsDeHumo =>
  async (id) =>
    idUsuarioDeHumo !== null &&
    (await reportes.buscarPorId(idReporte(id)))?.authorId === idUsuarioDeHumo;

/** Envuelve un manejador para que ignore los eventos de reportes de humo. */
export const salvoHumo =
  (esDeHumo: EsDeHumo, manejar: (evento: EventoDeIntegracion) => Promise<unknown>) =>
  async (evento: EventoDeIntegracion): Promise<void> => {
    const { idReporte: id } = (evento.contenido ?? {}) as { idReporte?: unknown };
    if (typeof id === 'string' && (await esDeHumo(id))) return;
    await manejar(evento);
  };
