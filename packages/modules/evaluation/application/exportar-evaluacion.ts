import { validarEntrada } from '@gis/contracts';
import { z } from 'zod';
import { aCsv, COLUMNAS_EXPORTADAS } from '../domain/exportacion.js';
import type { NombreDeTabla } from '../domain/exportacion.js';
import type { RepositorioDeExportacion } from '../domain/ports.js';
import { esquemaRol, exigirModerador } from './entradas.js';

const esquemaEntrada = z.object({ rolActor: esquemaRol });

/**
 * ADR-007: todo el registro y lo que produjeron las herramientas, un CSV por tabla, para
 * `pnpm piloto:analizar` y `pnpm piloto:sensibilidad`. Solo para moderadores.
 */
export class ExportarEvaluacion {
  constructor(private readonly exportacion: RepositorioDeExportacion) {}

  async ejecutar(entrada: z.input<typeof esquemaEntrada>): Promise<Record<NombreDeTabla, string>> {
    exigirModerador(validarEntrada(esquemaEntrada, entrada).rolActor);
    const tablas = await this.exportacion.exportar();
    const nombres = Object.keys(COLUMNAS_EXPORTADAS) as NombreDeTabla[];
    return Object.fromEntries(nombres.map((n) => [n, aCsv(n, tablas[n])])) as Record<
      NombreDeTabla,
      string
    >;
  }
}
