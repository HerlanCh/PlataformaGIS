// Métricas del piloto desde la línea de comandos (Fase 13): el resumen en JSON y, si se pide, los
// reportes del periodo en CSV para el análisis frente al grupo de WhatsApp.
import { writeFile } from 'node:fs/promises';
import { aCsv } from '@gis/module-metrics';
import type { ConsultarMetricas, PeriodoConMetricas } from '@gis/module-metrics';
import { rutaDentroDe } from './clasificador.js';

export interface SalidaDeMetricas {
  readonly resumen: PeriodoConMetricas;
  /** Ruta del CSV escrito, o `null` si no se pidió. */
  readonly csv: string | null;
  readonly filas: number;
}

/**
 * Consulta el periodo como moderador (la línea de comandos ya tiene la base) y escribe el CSV dentro
 * del repositorio.
 * @throws {Error} si el destino sale del repositorio o no termina en `.csv`.
 */
export async function exportarMetricas(opciones: {
  readonly raiz: string;
  readonly desde: string;
  readonly hasta: string;
  readonly destino?: string;
  readonly consultar: Pick<ConsultarMetricas, 'ejecutar' | 'exportar'>;
}): Promise<SalidaDeMetricas> {
  const destino = opciones.destino ? rutaDentroDe(opciones.raiz, opciones.destino, '.csv') : null;
  const periodo = { rolActor: 'MODERADOR' as const, desde: opciones.desde, hasta: opciones.hasta };
  const resumen = await opciones.consultar.ejecutar(periodo);
  if (!destino) return { resumen, csv: null, filas: 0 };
  const registros = await opciones.consultar.exportar(periodo);
  await writeFile(destino, aCsv(registros));
  return { resumen, csv: destino, filas: registros.length };
}
