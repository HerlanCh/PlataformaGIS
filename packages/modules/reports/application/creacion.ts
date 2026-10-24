import {
  aErrorDeAplicacion,
  codigoCategoria,
  ErrorConflicto,
  ErrorValidacionFallida,
  PuntoGeo,
} from '@gis/shared-kernel';
import type { IdUsuario } from '@gis/shared-kernel';
import type { Categoria } from '../domain/category.js';
import type { RepositorioDeCategorias, RepositorioDeReportes } from '../domain/ports.js';
import type { Reporte } from '../domain/report.js';
import { proyeccionPublica } from '../domain/reporte-publico.js';
import type { ReportePublico } from '../domain/reporte-publico.js';
import { CLAVE_DE_IDEMPOTENCIA_REPETIDA } from './ports.js';

// Pasos comunes a crear un reporte de la comunidad (HU-01) y publicar uno oficial (HU-13).

/**
 * Lo que ve el autor de su reporte. El de un autor silenciado se guarda `RECHAZADO`, pero él
 * no recibe aviso (SRS 3.2.7): lo sigue viendo `ACTIVO`.
 */
export const vistaDelAutor = (reporte: Reporte): ReportePublico => {
  const publico = proyeccionPublica(reporte);
  return reporte.motivoRechazo === 'AUTOR_SILENCIADO' ? { ...publico, estado: 'ACTIVO' } : publico;
};

/**
 * El reporte ya creado con esa clave de idempotencia, o `null`. Un reenvío no repite efectos (HU-05).
 * @throws {ErrorConflicto} si la clave la usó otro usuario.
 */
export async function buscarReenvio(
  reportes: RepositorioDeReportes,
  idAutor: IdUsuario,
  clave: string,
): Promise<Reporte | null> {
  const previo = await reportes.buscarPorClaveDeIdempotencia(clave);
  if (previo && previo.authorId !== idAutor) {
    throw new ErrorConflicto(
      'CLAVE_DE_IDEMPOTENCIA_AJENA',
      'La clave de idempotencia ya la usó otro usuario',
    );
  }
  return previo;
}

/** @throws {ErrorValidacionFallida} si la categoría no existe. */
export async function buscarCategoria(
  categorias: RepositorioDeCategorias,
  codigo: string,
): Promise<Categoria> {
  const categoria = await categorias.buscarPorCodigo(codigoCategoria(codigo));
  if (!categoria) {
    throw new ErrorValidacionFallida('CATEGORIA_DESCONOCIDA', `No existe la categoría "${codigo}"`);
  }
  return categoria;
}

/** @throws {ErrorValidacionFallida} si el punto cae fuera de La Paz y El Alto. */
export function puntoDe(latitud: number, longitud: number): PuntoGeo {
  try {
    return PuntoGeo.crear(latitud, longitud);
  } catch (error) {
    throw aErrorDeAplicacion(error, { FUERA_DEL_AREA_DE_SERVICIO: 'VALIDACION_FALLIDA' });
  }
}

/**
 * Ejecuta `crear` y, si otro envío simultáneo con la misma clave ganó la carrera, devuelve lo que
 * dio `reenvio` en lugar del error.
 */
export async function creacionIdempotente<T>(
  crear: () => Promise<T>,
  reenvio: () => Promise<T | null>,
): Promise<T> {
  try {
    return await crear();
  } catch (error) {
    if (error instanceof ErrorConflicto && error.codigo === CLAVE_DE_IDEMPOTENCIA_REPETIDA) {
      const ganador = await reenvio();
      if (ganador) return ganador;
    }
    throw error;
  }
}
