import type { Caja } from '../../domain/geo.js';
import type { EnviosParaEtiquetar } from '../../services/evaluacion.js';

/** Las horas antes del instante en que se buscan envíos: lo vigente puede venir de más de 24 h. */
export const HORAS_DE_BUSQUEDA = 48;

export interface GrupoDeLaZona {
  readonly grupo: string;
  readonly categoria: string;
  readonly envios: number;
}

const PRIORIDAD = ['CONSENSO', 'A', 'B'] as const;

const dentro = (caja: Caja, p: { latitud: number; longitud: number }) =>
  p.latitud >= caja.latitudMin &&
  p.latitud <= caja.latitudMax &&
  p.longitud >= caja.longitudMin &&
  p.longitud <= caja.longitudMax;

/**
 * Los incidentes (grupos del etiquetado) con envíos en la zona de la instantánea, entre los que los
 * evaluadores eligen la clave. El grupo de cada envío es el del consenso; si no lo hay, el de A; si
 * no, el de B: la misma regla que usa el análisis.
 */
export function gruposDeLaZona(datos: EnviosParaEtiquetar, caja: Caja): GrupoDeLaZona[] {
  const grupoDe = (idEnvio: string) =>
    PRIORIDAD.map(
      (evaluador) =>
        datos.etiquetas.find((e) => e.idEnvio === idEnvio && e.evaluador === evaluador)?.grupo,
    ).find((g) => g !== undefined);
  const porGrupo = new Map<string, GrupoDeLaZona>();
  for (const envio of datos.envios.filter((e) => dentro(caja, e.publicLocation))) {
    const grupo = grupoDe(envio.idEnvio);
    if (grupo === undefined) continue;
    const previo = porGrupo.get(grupo);
    porGrupo.set(grupo, {
      grupo,
      categoria: previo?.categoria ?? envio.codigoCategoria,
      envios: (previo?.envios ?? 0) + 1,
    });
  }
  return [...porGrupo.values()].toSorted((a, b) => a.grupo.localeCompare(b.grupo));
}
