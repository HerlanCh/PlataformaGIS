// La exportación de `pnpm piloto:exportar` leída y tipada: un CSV por tabla con las columnas de
// `COLUMNAS_EXPORTADAS`. Las horas pasan a milisegundos para operar con ellas.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COLUMNAS_EXPORTADAS } from '@gis/module-evaluation';
import type { NombreDeTabla } from '@gis/module-evaluation';
import { leerCsv } from './csv.js';

export type Vista = 'PROCESADA' | 'BASE';

export interface EnvioDato {
  readonly idEnvio: string;
  readonly tipo: 'CREADO' | 'DUPLICADO';
  readonly idReporte: string;
  readonly codigoCategoria: string;
  readonly latitud: number;
  readonly longitud: number;
  readonly fuenteOficial: string | null;
  readonly recibidoEn: number;
}

export interface TransicionDato {
  readonly idReporte: string;
  readonly estado: string;
  readonly caducaEn: number | null;
  readonly ocurridoEn: number;
}

export interface VotoDato {
  readonly idReporte: string;
  readonly valor: 'CONFIRMACION' | 'NEGACION';
  readonly peso: number;
  readonly decision: string;
  readonly ocurridoEn: number;
}

export interface InstantaneaDato {
  readonly id: string;
  readonly nombre: string;
  readonly instante: number;
}

export interface PuntoDato {
  readonly idInstantanea: string;
  readonly vista: Vista;
  readonly idPunto: string;
  readonly idReporte: string;
}

export interface TareaDato {
  readonly idTarea: string;
  readonly codigoParticipante: string;
  readonly secuencia: number;
  readonly orden: number;
  readonly vista: Vista;
  readonly escenario: string;
  readonly idInstantanea: string;
  readonly duracionMs: number | null;
  readonly agotada: boolean | null;
}

export interface MarcaDato {
  readonly idTarea: string;
  readonly idPunto: string;
  readonly msDesdeInicio: number;
}

export interface EtiquetaDato {
  readonly evaluador: string;
  readonly idEnvio: string;
  readonly grupo: string;
}

export interface ClaveDato {
  readonly idInstantanea: string;
  readonly grupo: string;
}

export interface VerificacionDato {
  readonly idReporte: string;
  readonly resultado: 'REAL' | 'FALSO' | 'NO_VERIFICABLE';
  readonly finEn: number | null;
}

export interface DatosDeEvaluacion {
  readonly envios: readonly EnvioDato[];
  readonly transiciones: readonly TransicionDato[];
  readonly votos: readonly VotoDato[];
  readonly instantaneas: readonly InstantaneaDato[];
  readonly puntos: readonly PuntoDato[];
  readonly tareas: readonly TareaDato[];
  readonly marcas: readonly MarcaDato[];
  readonly etiquetas: readonly EtiquetaDato[];
  readonly claves: readonly ClaveDato[];
  readonly verificaciones: readonly VerificacionDato[];
}

type Crudo = Record<string, string>;

/** Hora ISO 8601 con zona (como las exporta la base); vacía es nula. */
function hora(valor: string | undefined): number | null {
  if (!valor) return null;
  const ms = Date.parse(valor);
  // Con zona: termina en Z o en un desfase como -04:00 (sin zona, Date.parse usaría la hora local).
  const conZona = valor.includes('T') && /(?:Z|[+-]\d{2}:?\d{2})$/.test(valor);
  if (Number.isNaN(ms) || !conZona) {
    throw new Error(`Hora inválida (se espera ISO 8601 con zona): ${valor}`);
  }
  return ms;
}

const exigirHora = (valor: string | undefined): number => {
  const ms = hora(valor);
  if (ms === null) throw new Error('Falta una hora obligatoria');
  return ms;
};

const numero = (valor: string | undefined): number | null =>
  valor === undefined || valor === '' ? null : Number(valor);

const nulo = (valor: string | undefined): string | null => valor || null;

const booleano = (valor: string | undefined): boolean | null =>
  valor === '' || valor === undefined ? null : valor === 'true';

const LECTORES = {
  envios: (f: Crudo): EnvioDato => ({
    idEnvio: f['id_envio']!,
    tipo: f['tipo'] as EnvioDato['tipo'],
    idReporte: f['id_reporte']!,
    codigoCategoria: f['codigo_categoria']!,
    latitud: Number(f['latitud']),
    longitud: Number(f['longitud']),
    fuenteOficial: nulo(f['fuente_oficial']),
    recibidoEn: exigirHora(f['recibido_en']),
  }),
  transiciones: (f: Crudo): TransicionDato => ({
    idReporte: f['id_reporte']!,
    estado: f['estado']!,
    caducaEn: hora(f['caduca_en']),
    ocurridoEn: exigirHora(f['ocurrido_en']),
  }),
  votos: (f: Crudo): VotoDato => ({
    idReporte: f['id_reporte']!,
    valor: f['valor'] as VotoDato['valor'],
    peso: Number(f['peso']),
    decision: f['decision']!,
    ocurridoEn: exigirHora(f['ocurrido_en']),
  }),
  instantaneas: (f: Crudo): InstantaneaDato => ({
    id: f['id']!,
    nombre: f['nombre']!,
    instante: exigirHora(f['instante']),
  }),
  puntos: (f: Crudo): PuntoDato => ({
    idInstantanea: f['id_instantanea']!,
    vista: f['vista'] as Vista,
    idPunto: f['id_punto']!,
    idReporte: f['id_reporte']!,
  }),
  tareas: (f: Crudo): TareaDato => ({
    idTarea: f['id_tarea']!,
    codigoParticipante: f['codigo_participante']!,
    secuencia: Number(f['secuencia']),
    orden: Number(f['orden']),
    vista: f['vista'] as Vista,
    escenario: f['escenario']!,
    idInstantanea: f['id_instantanea']!,
    duracionMs: numero(f['duracion_ms']),
    agotada: booleano(f['agotada']),
  }),
  marcas: (f: Crudo): MarcaDato => ({
    idTarea: f['id_tarea']!,
    idPunto: f['id_punto']!,
    msDesdeInicio: Number(f['ms_desde_inicio']),
  }),
  etiquetas: (f: Crudo): EtiquetaDato => ({
    evaluador: f['evaluador']!,
    idEnvio: f['id_envio']!,
    grupo: f['grupo']!,
  }),
  claves: (f: Crudo): ClaveDato => ({
    idInstantanea: f['id_instantanea']!,
    grupo: f['grupo']!,
  }),
  verificaciones: (f: Crudo): VerificacionDato => ({
    idReporte: f['id_reporte']!,
    resultado: f['resultado'] as VerificacionDato['resultado'],
    finEn: hora(f['fin_en']),
  }),
} satisfies Record<NombreDeTabla, (f: Crudo) => unknown>;

/**
 * Lee los CSV de la exportación ya cargados en memoria.
 * @throws {Error} si falta una columna o una hora no es ISO 8601 con zona.
 */
export function leerExportacion(
  textos: Readonly<Record<NombreDeTabla, string>>,
): DatosDeEvaluacion {
  const datos: Partial<Record<NombreDeTabla, unknown[]>> = {};
  for (const tabla of Object.keys(LECTORES) as NombreDeTabla[]) {
    const filas = leerCsv(textos[tabla]);
    const faltan = COLUMNAS_EXPORTADAS[tabla].filter((c) => filas.length > 0 && !(c in filas[0]!));
    if (faltan.length > 0) throw new Error(`${tabla}.csv: faltan columnas ${faltan.join(', ')}`);
    const leer = LECTORES[tabla] as (f: Crudo) => unknown;
    datos[tabla] = filas.map((fila) => leer(fila));
  }
  return datos as unknown as DatosDeEvaluacion;
}

/** Lee la carpeta de la exportación: un `<tabla>.csv` por tabla. */
export async function leerCarpeta(carpeta: string): Promise<DatosDeEvaluacion> {
  const tablas = Object.keys(LECTORES) as NombreDeTabla[];
  const textos = await Promise.all(tablas.map((t) => readFile(join(carpeta, `${t}.csv`), 'utf8')));
  return leerExportacion(
    Object.fromEntries(tablas.map((t, i) => [t, textos[i]!])) as Record<NombreDeTabla, string>,
  );
}
