import type { Clasificacion, Clasificador, DatosParaClasificar } from '../domain/clasificacion.js';
import { clasificarPorReglas } from '../domain/reglas-de-clasificacion.js';

/** Clasificador local por reglas (HU-10). No depende de la red: es el respaldo de cualquier otro. */
export class ClasificadorPorReglas implements Clasificador {
  static readonly nombre = 'reglas-v1';

  clasificar(datos: DatosParaClasificar): Promise<Clasificacion> {
    return Promise.resolve({
      ...clasificarPorReglas(datos),
      clasificador: ClasificadorPorReglas.nombre,
    });
  }
}
