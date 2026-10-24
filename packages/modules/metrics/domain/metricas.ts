// Métricas de uso del piloto (Fase 13): qué tanto se reporta, cuánto tarda la comunidad en
// confirmar y cómo terminan los reportes. Sin datos personales: ni autor, ni votantes, ni puntos.

/** Cómo terminó un reporte: venció, la comunidad lo dio por resuelto o un moderador lo rechazó. */
export type Cierre = 'CADUCIDAD' | 'VOTOS' | 'MODERACION';

export const CIERRES: readonly Cierre[] = ['CADUCIDAD', 'VOTOS', 'MODERACION'];

/** Lo que se guarda de cada reporte, desde que se activa el módulo. */
export interface RegistroDeReporte {
  readonly idReporte: string;
  readonly codigoCategoria: string;
  /** Incidente de fuente oficial (HU-13): se cuenta aparte. */
  readonly esOficial: boolean;
  readonly creadoEn: Date;
  /** Primer «Sigue ahí» o primer reporte duplicado de otra persona. */
  readonly primeraConfirmacionEn: Date | null;
  /** Cuando pasó a `CONFIRMADO` por el umbral de votos. */
  readonly confirmadoEn: Date | null;
  readonly cierre: Cierre | null;
  readonly cerradoEn: Date | null;
}

/** Personas distintas que reportaron o votaron un día (hora de Bolivia). */
export interface ActividadDiaria {
  readonly dia: string;
  readonly usuariosActivos: number;
}

export interface Distribucion {
  readonly mediana: number;
  readonly p90: number;
}

export interface ResumenDeMetricas {
  readonly reportes: {
    readonly total: number;
    readonly comunitarios: number;
    readonly oficiales: number;
    readonly porCategoria: readonly { readonly codigoCategoria: string; readonly total: number }[];
  };
  /** Solo de los reportes de la comunidad. */
  readonly confirmacion: {
    readonly conAlgunaConfirmacion: number;
    readonly confirmados: number;
    /** Porcentaje de reportes comunitarios que llegaron a `CONFIRMADO`; `null` sin reportes. */
    readonly porcentajeConfirmados: number | null;
    /** Minutos desde la creación hasta la primera confirmación; `null` si ninguno la tuvo. */
    readonly minutosHastaPrimeraConfirmacion: Distribucion | null;
  };
  /** Solo de los reportes de la comunidad ya cerrados. */
  readonly cierres: {
    readonly cerrados: number;
    readonly abiertos: number;
    readonly porTipo: readonly {
      readonly cierre: Cierre;
      readonly total: number;
      readonly porcentaje: number | null;
    }[];
  };
  readonly usuariosActivos: readonly ActividadDiaria[];
}

/** Bolivia está en UTC−4 todo el año: no tiene horario de verano. */
const DESFASE_LA_PAZ_MS = 4 * 60 * 60 * 1000;

/** Día de la fecha en la hora de Bolivia: `2026-10-24`. */
export const diaEnLaPaz = (fecha: Date): string =>
  new Date(fecha.getTime() - DESFASE_LA_PAZ_MS).toISOString().slice(0, 10);

/** Instante en que empieza un día de Bolivia. */
export const inicioDelDia = (dia: string): Date =>
  new Date(Date.parse(`${dia}T00:00:00.000Z`) + DESFASE_LA_PAZ_MS);

/** El día siguiente: `2026-10-31` → `2026-11-01`. */
export const diaSiguiente = (dia: string): string =>
  new Date(Date.parse(`${dia}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Percentil por rango más cercano: el valor que deja debajo al menos el `p` % de la muestra.
 * @throws {RangeError} si la muestra está vacía o `p` no está entre 0 y 100.
 */
export function percentil(valores: readonly number[], p: number): number {
  if (valores.length === 0) throw new RangeError('La muestra está vacía');
  if (p < 0 || p > 100) throw new RangeError('El percentil va de 0 a 100');
  const ordenados = [...valores].sort((a, b) => a - b);
  const rango = Math.max(1, Math.ceil((p / 100) * ordenados.length));
  return ordenados[rango - 1]!;
}

const porcentaje = (parte: number, total: number): number | null =>
  total === 0 ? null : Math.round((parte / total) * 1000) / 10;

const minutosEntre = (desde: Date, hasta: Date): number =>
  Math.round(((hasta.getTime() - desde.getTime()) / 60_000) * 10) / 10;

function porCategoria(registros: readonly RegistroDeReporte[]) {
  const conteo = new Map<string, number>();
  for (const r of registros)
    conteo.set(r.codigoCategoria, (conteo.get(r.codigoCategoria) ?? 0) + 1);
  return [...conteo]
    .map(([codigoCategoria, total]) => ({ codigoCategoria, total }))
    .sort((a, b) => b.total - a.total || a.codigoCategoria.localeCompare(b.codigoCategoria));
}

function confirmacion(comunitarios: readonly RegistroDeReporte[]) {
  const minutos = comunitarios.flatMap((r) =>
    r.primeraConfirmacionEn ? [minutosEntre(r.creadoEn, r.primeraConfirmacionEn)] : [],
  );
  const confirmados = comunitarios.filter((r) => r.confirmadoEn !== null).length;
  return {
    conAlgunaConfirmacion: minutos.length,
    confirmados,
    porcentajeConfirmados: porcentaje(confirmados, comunitarios.length),
    minutosHastaPrimeraConfirmacion:
      minutos.length === 0
        ? null
        : { mediana: percentil(minutos, 50), p90: percentil(minutos, 90) },
  };
}

function cierres(comunitarios: readonly RegistroDeReporte[]) {
  const cerrados = comunitarios.filter((r) => r.cierre !== null);
  return {
    cerrados: cerrados.length,
    abiertos: comunitarios.length - cerrados.length,
    porTipo: CIERRES.map((cierre) => {
      const total = cerrados.filter((r) => r.cierre === cierre).length;
      return { cierre, total, porcentaje: porcentaje(total, cerrados.length) };
    }),
  };
}

/** Resume los reportes creados en un periodo y la actividad de sus días. */
export function resumir(
  registros: readonly RegistroDeReporte[],
  actividad: readonly ActividadDiaria[],
): ResumenDeMetricas {
  const comunitarios = registros.filter((r) => !r.esOficial);
  return {
    reportes: {
      total: registros.length,
      comunitarios: comunitarios.length,
      oficiales: registros.length - comunitarios.length,
      porCategoria: porCategoria(registros),
    },
    confirmacion: confirmacion(comunitarios),
    cierres: cierres(comunitarios),
    usuariosActivos: [...actividad].sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}
