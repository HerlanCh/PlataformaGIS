// Fuentes oficiales que un moderador puede citar al publicar un incidente (HU-13).
import type { ReportePublico } from '@gis/api-client';

export type FuenteOficial = NonNullable<ReportePublico['fuenteOficial']>;

export const FUENTES_OFICIALES: readonly {
  readonly codigo: FuenteOficial;
  readonly nombre: string;
}[] = [
  { codigo: 'TRANSITO', nombre: 'Tránsito' },
  { codigo: 'ABC', nombre: 'ABC' },
  { codigo: 'MI_TELEFERICO', nombre: 'Mi Teleférico' },
  { codigo: 'OTRA', nombre: 'Otra fuente oficial' },
];

/** «Tránsito», o «Comunidad» si el reporte no es de una fuente oficial. */
export function nombreDeFuente(fuente: FuenteOficial | null): string {
  if (fuente === null) return 'Comunidad';
  return FUENTES_OFICIALES.find((f) => f.codigo === fuente)?.nombre ?? 'Fuente oficial';
}
