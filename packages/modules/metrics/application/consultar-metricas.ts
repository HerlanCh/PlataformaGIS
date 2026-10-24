import { validarEntrada } from '@gis/contracts';
import { ErrorProhibido, ErrorValidacionFallida } from '@gis/shared-kernel';
import { z } from 'zod';
import { diaSiguiente, inicioDelDia, resumir } from '../domain/metricas.js';
import type { RegistroDeReporte, ResumenDeMetricas } from '../domain/metricas.js';
import type { RepositorioDeMetricas } from '../domain/ports.js';

/** Un periodo más largo que el piloto no tiene sentido y haría lenta la consulta. */
export const MAX_DIAS_DE_CONSULTA = 366;

const esquemaDia = z.iso.date();

const esquemaEntrada = z.object({
  rolActor: z.enum(['CIUDADANO', 'MODERADOR']),
  /** Días de Bolivia, ambos incluidos. */
  desde: esquemaDia,
  hasta: esquemaDia,
});

export type EntradaConsultarMetricas = z.input<typeof esquemaEntrada>;

export interface PeriodoConMetricas extends ResumenDeMetricas {
  readonly desde: string;
  readonly hasta: string;
}

/** Fase 13: las métricas de uso del piloto, solo para moderadores. */
export class ConsultarMetricas {
  constructor(private readonly metricas: RepositorioDeMetricas) {}

  async ejecutar(entrada: EntradaConsultarMetricas): Promise<PeriodoConMetricas> {
    const { desde, hasta } = this.validar(entrada);
    const [registros, actividad] = await Promise.all([
      this.registros(desde, hasta),
      this.metricas.actividadEntre(desde, hasta),
    ]);
    return { desde, hasta, ...resumir(registros, actividad) };
  }

  /** Los reportes del periodo, uno por fila, para el análisis del piloto. */
  async exportar(entrada: EntradaConsultarMetricas): Promise<readonly RegistroDeReporte[]> {
    const { desde, hasta } = this.validar(entrada);
    return this.registros(desde, hasta);
  }

  private registros(desde: string, hasta: string): Promise<readonly RegistroDeReporte[]> {
    return this.metricas.buscarRegistros(inicioDelDia(desde), inicioDelDia(diaSiguiente(hasta)));
  }

  private validar(entrada: EntradaConsultarMetricas): { desde: string; hasta: string } {
    const datos = validarEntrada(esquemaEntrada, entrada);
    if (datos.rolActor !== 'MODERADOR') {
      throw new ErrorProhibido('ROL_INSUFICIENTE', 'Solo un moderador puede ver las métricas');
    }
    const dias = (Date.parse(datos.hasta) - Date.parse(datos.desde)) / 86_400_000;
    if (dias < 0 || dias >= MAX_DIAS_DE_CONSULTA) {
      throw new ErrorValidacionFallida(
        'PERIODO_INVALIDO',
        `El periodo debe ir de "desde" a "hasta" y durar como mucho ${MAX_DIAS_DE_CONSULTA} días`,
      );
    }
    return { desde: datos.desde, hasta: datos.hasta };
  }
}

/** Columnas del CSV de reportes: sin ubicación, autor ni votantes. */
export const COLUMNAS_CSV = [
  'id_reporte',
  'codigo_categoria',
  'es_oficial',
  'creado_en',
  'primera_confirmacion_en',
  'confirmado_en',
  'cierre',
  'cerrado_en',
] as const;

const fecha = (valor: Date | null): string => valor?.toISOString() ?? '';

/** CSV con encabezado. Ningún campo lleva comas ni comillas: no hace falta escaparlos. */
export function aCsv(registros: readonly RegistroDeReporte[]): string {
  const filas = registros.map((r) =>
    [
      r.idReporte,
      r.codigoCategoria,
      String(r.esOficial),
      fecha(r.creadoEn),
      fecha(r.primeraConfirmacionEn),
      fecha(r.confirmadoEn),
      r.cierre ?? '',
      fecha(r.cerradoEn),
    ].join(','),
  );
  return [COLUMNAS_CSV.join(','), ...filas].join('\n') + '\n';
}
