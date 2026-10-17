import { esquemaCodigoCategoria, validarEntrada } from '@gis/contracts';
import { codigoCategoria } from '@gis/shared-kernel';
import type { Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeReportes } from '../domain/ports.js';
import type { ReportePublico } from '../domain/reporte-publico.js';

/** Tope de reportes por ventana: el mapa no muestra más marcadores útiles que estos. */
export const MAX_REPORTES_POR_VENTANA = 500;

const latitud = z.number().min(-90).max(90);
const longitud = z.number().min(-180).max(180);

const esquemaEntrada = z
  .object({
    latitudMin: latitud,
    latitudMax: latitud,
    longitudMin: longitud,
    longitudMax: longitud,
    categorias: z.array(esquemaCodigoCategoria).default([]),
  })
  .refine((caja) => caja.latitudMin < caja.latitudMax && caja.longitudMin < caja.longitudMax, {
    message: 'Cada mínimo de la ventana debe ser menor que su máximo',
  });

export type EntradaListarReportesEnVentana = z.input<typeof esquemaEntrada>;

/** HU-02: reportes vigentes del área visible del mapa, solo con su proyección pública. */
export class ListarReportesEnVentana {
  constructor(
    private readonly reportes: RepositorioDeReportes,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: EntradaListarReportesEnVentana): Promise<readonly ReportePublico[]> {
    const { categorias, ...caja } = validarEntrada(esquemaEntrada, entrada);
    const ahora = this.reloj.ahora();
    const encontrados = await this.reportes.buscarEnVentana(
      caja,
      categorias.map(codigoCategoria),
      ['ACTIVO', 'CONFIRMADO'],
      MAX_REPORTES_POR_VENTANA,
    );
    // Uno vencido sigue vigente en la tabla hasta que pasa `CaducarReportes`: no se muestra.
    return encontrados.filter((reporte) => reporte.caducaEn.getTime() >= ahora.getTime());
  }
}
