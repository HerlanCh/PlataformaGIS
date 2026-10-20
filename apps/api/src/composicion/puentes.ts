// Puertos entre módulos (ADR-001): cada módulo declara lo que necesita saber de otro y la raíz de
// composición lo conecta aquí con la interfaz pública del módulo dueño. Ningún módulo se conoce.
import type { ConsultaParaClasificar } from '@gis/module-classifier';
import type { RepositorioDeReportes } from '@gis/module-reports';
import type { ReputacionDelAutor } from '@gis/module-reports';
import type { ConsultaDeAutor } from '@gis/module-subscriptions';
import type { ConsultaDeReporte as ConsultaParaVerificacion } from '@gis/module-verification';
import type { ConsultaDeReporte as ConsultaParaModeracion } from '@gis/module-moderation';
import type { IdUsuario } from '@gis/shared-kernel';

/** `verification` necesita autor, estado, ubicación real y extensiones del reporte votado. */
export const consultaParaVerificacion = (
  reportes: RepositorioDeReportes,
): ConsultaParaVerificacion => ({
  async buscarPorId(id) {
    const reporte = await reportes.buscarPorId(id);
    return (
      reporte && {
        id: reporte.id,
        authorId: reporte.authorId,
        estado: reporte.estado,
        location: reporte.location,
        extensiones: reporte.extensiones,
      }
    );
  },
});

/** `subscriptions` necesita el autor para no avisarle de su propio reporte. */
export const consultaDeAutor = (reportes: RepositorioDeReportes): ConsultaDeAutor => ({
  async autorDe(id) {
    return (await reportes.buscarPorId(id))?.authorId ?? null;
  },
});

/** `moderation` necesita saber si el reporte existe y sigue vigente. */
export const consultaParaModeracion = (
  reportes: RepositorioDeReportes,
): ConsultaParaModeracion => ({
  async estadoDe(id) {
    return (await reportes.buscarPorId(id))?.estado ?? null;
  },
});

/** Ventana en la que el clasificador cuenta los reportes del mismo autor (HU-10). */
export const VENTANA_DE_FRECUENCIA_MS = 60 * 60_000;

/**
 * `classifier` necesita la descripción privada y cuántos reportes hizo el autor en la hora anterior
 * al reporte, incluido este.
 */
export const consultaParaClasificar = (
  reportes: RepositorioDeReportes,
): ConsultaParaClasificar => ({
  async datosDe(id) {
    const reporte = await reportes.buscarPorId(id);
    if (!reporte) return null;
    const desde = new Date(reporte.creadoEn.getTime() - VENTANA_DE_FRECUENCIA_MS);
    return {
      descripcion: reporte.descripcion,
      reportesRecientesDelAutor: await reportes.contarDelAutor(
        reporte.authorId,
        desde,
        reporte.creadoEn,
      ),
    };
  },
});

/** Lo que `reports` lee de la reputación, que es de `verification`. */
interface FuenteDeReputacion {
  buscarPorUsuario(id: IdUsuario): Promise<{ readonly estaSilenciado: boolean } | null>;
}

/** `reports` necesita saber si el autor está silenciado (SRS 3.2.7). */
export const reputacionDelAutor = (reputaciones: FuenteDeReputacion): ReputacionDelAutor => ({
  async estaSilenciado(id) {
    return (await reputaciones.buscarPorUsuario(id))?.estaSilenciado ?? false;
  },
});
