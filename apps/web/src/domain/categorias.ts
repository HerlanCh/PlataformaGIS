// Las cinco categorías del MVP (SRS 3.1). Cada una es una "línea" de la red, con el color de una
// línea de Mi Teleférico: el color identifica la categoría en el mapa, en las listas y en la leyenda.

export type CodigoCategoria = 'bloqueo' | 'accidente' | 'robo' | 'infraestructura' | 'jauria';

export interface Categoria {
  readonly codigo: CodigoCategoria;
  readonly nombre: string;
  /** Nombre corto para marcadores y filas. */
  readonly corto: string;
  /** Línea de Mi Teleférico cuyo color toma. */
  readonly linea: string;
  /** Variable CSS del color de la línea. */
  readonly color: string;
  /** Horas que se muestra un reporte nuevo (TTL inicial). */
  readonly horas: number;
}

export const CATEGORIAS: readonly Categoria[] = [
  {
    codigo: 'bloqueo',
    nombre: 'Bloqueo o protesta vial',
    corto: 'Bloqueo',
    linea: 'Amarilla',
    color: 'var(--linea-amarilla)',
    horas: 6,
  },
  {
    codigo: 'accidente',
    nombre: 'Accidente de tránsito',
    corto: 'Accidente',
    linea: 'Roja',
    color: 'var(--linea-roja)',
    horas: 3,
  },
  {
    codigo: 'robo',
    nombre: 'Hecho delictivo o robo',
    corto: 'Robo',
    linea: 'Morada',
    color: 'var(--linea-morada)',
    horas: 2,
  },
  {
    codigo: 'infraestructura',
    nombre: 'Derrumbe, vía dañada o fuga',
    corto: 'Vía dañada',
    linea: 'Café',
    color: 'var(--linea-cafe)',
    horas: 24,
  },
  {
    codigo: 'jauria',
    nombre: 'Jauría de perros agresivos',
    corto: 'Jauría',
    linea: 'Naranja',
    color: 'var(--linea-naranja)',
    horas: 2,
  },
];

const PORCODIGO = new Map(CATEGORIAS.map((c) => [c.codigo, c]));

/** Categoría de un código; uno desconocido (de una versión futura de la API) se muestra genérico. */
export function categoriaDe(codigo: string): Categoria {
  return (
    PORCODIGO.get(codigo as CodigoCategoria) ?? {
      codigo: codigo as CodigoCategoria,
      nombre: 'Incidente',
      corto: 'Incidente',
      linea: 'Plateada',
      color: 'var(--linea-plateada)',
      horas: 0,
    }
  );
}
