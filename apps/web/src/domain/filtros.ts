// Filtros del mapa: qué líneas se ven y desde hace cuánto. Se aplican en el cliente sobre la lista
// de la ventana, así no se vuelve a pedir nada y los eventos en vivo siguen llegando.
import type { CodigoCategoria } from './categorias.js';
import type { ReportePublico } from './reportes.js';

export type Antiguedad = 'hora' | 'tres-horas' | 'hoy' | 'todos';

export const ANTIGUEDADES: readonly { readonly valor: Antiguedad; readonly nombre: string }[] = [
  { valor: 'hora', nombre: '1 hora' },
  { valor: 'tres-horas', nombre: '3 horas' },
  { valor: 'hoy', nombre: 'Hoy' },
  { valor: 'todos', nombre: 'Todos' },
];

export interface Filtros {
  /** Líneas apagadas: sus reportes no se muestran. */
  readonly ocultas: readonly CodigoCategoria[];
  readonly antiguedad: Antiguedad;
}

export const SIN_FILTROS: Filtros = { ocultas: [], antiguedad: 'todos' };

const HORA_MS = 3_600_000;
/** Bolivia no tiene horario de verano: siempre UTC−4. */
const DESFASE_LA_PAZ = '-04:00';

/** Medianoche de hoy en La Paz. */
export function inicioDeHoy(ahora: Date): Date {
  const dia = ahora.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  return new Date(`${dia}T00:00:00${DESFASE_LA_PAZ}`);
}

/** Desde qué momento se muestran los reportes, o `null` si no hay límite. */
export function desdeCuando(antiguedad: Antiguedad, ahora: Date): Date | null {
  switch (antiguedad) {
    case 'hora':
      return new Date(ahora.getTime() - HORA_MS);
    case 'tres-horas':
      return new Date(ahora.getTime() - 3 * HORA_MS);
    case 'hoy':
      return inicioDeHoy(ahora);
    case 'todos':
      return null;
  }
}

export const hayFiltros = (filtros: Filtros): boolean =>
  filtros.ocultas.length > 0 || filtros.antiguedad !== 'todos';

/** Los reportes que pasan los filtros, en el mismo orden. */
export function filtrarReportes(
  lista: readonly ReportePublico[],
  filtros: Filtros,
  ahora: Date = new Date(),
): readonly ReportePublico[] {
  if (!hayFiltros(filtros)) return lista;
  const ocultas = new Set<string>(filtros.ocultas);
  const desde = desdeCuando(filtros.antiguedad, ahora)?.getTime() ?? -Infinity;
  return lista.filter((r) => !ocultas.has(r.codigoCategoria) && Date.parse(r.creadoEn) >= desde);
}
