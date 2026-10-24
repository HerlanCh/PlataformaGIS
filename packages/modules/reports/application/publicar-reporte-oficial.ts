import { esquemaCodigoCategoria, esquemaFuenteOficial, validarEntrada } from '@gis/contracts';
import { ErrorProhibido, idReporte, idUsuario } from '@gis/shared-kernel';
import type { GeneradorDeId, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeCategorias, RepositorioDeReportes } from '../domain/ports.js';
import { esClaveDeIdempotenciaValida, Reporte } from '../domain/report.js';
import { proyeccionPublica } from '../domain/reporte-publico.js';
import type { ReportePublico } from '../domain/reporte-publico.js';
import { buscarCategoria, buscarReenvio, creacionIdempotente, puntoDe } from './creacion.js';
import { eventosDeIntegracionDe } from './eventos.js';
import type { UnidadDeTrabajoDeReporte } from './ports.js';

const esquemaEntrada = z.object({
  idModerador: z.uuid(),
  rolActor: z.enum(['CIUDADANO', 'MODERADOR']),
  codigoCategoria: esquemaCodigoCategoria,
  latitud: z.number(),
  longitud: z.number(),
  fuenteOficial: esquemaFuenteOficial,
  idempotencyKey: z.string().refine(esClaveDeIdempotenciaValida, {
    message: 'La clave de idempotencia debe tener entre 8 y 128 letras, dígitos, "-" o "_"',
  }),
});

export type EntradaPublicarReporteOficial = z.input<typeof esquemaEntrada>;

export interface DependenciasPublicarReporteOficial {
  readonly reportes: RepositorioDeReportes;
  readonly categorias: RepositorioDeCategorias;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeReporte;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/**
 * HU-13: un moderador publica un incidente que anunció una fuente oficial. A diferencia de HU-01,
 * no se convierte en confirmación de otro reporte cercano ni consume el cupo de reportes: lo que
 * se publica es la fuente, no un aporte del moderador.
 */
export class PublicarReporteOficial {
  constructor(private readonly deps: DependenciasPublicarReporteOficial) {}

  async ejecutar(entrada: EntradaPublicarReporteOficial): Promise<ReportePublico> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    if (datos.rolActor !== 'MODERADOR') {
      throw new ErrorProhibido(
        'ROL_INSUFICIENTE',
        'Solo un moderador puede publicar incidentes oficiales',
      );
    }
    const idModerador = idUsuario(datos.idModerador);
    const reenvio = async (): Promise<ReportePublico | null> => {
      const previo = await buscarReenvio(this.deps.reportes, idModerador, datos.idempotencyKey);
      return previo && proyeccionPublica(previo);
    };
    const reenviado = await reenvio();
    if (reenviado) return reenviado;

    const categoria = await buscarCategoria(this.deps.categorias, datos.codigoCategoria);
    const punto = puntoDe(datos.latitud, datos.longitud);
    return creacionIdempotente(async () => {
      const reporte = Reporte.crear({
        id: idReporte(this.deps.ids.siguiente()),
        categoria,
        authorId: idModerador,
        location: punto,
        idempotencyKey: datos.idempotencyKey,
        ahora: this.deps.reloj.ahora(),
        fuenteOficial: datos.fuenteOficial,
      });
      await this.deps.unidadDeTrabajo.confirmar(
        reporte,
        eventosDeIntegracionDe(reporte, this.deps.ids),
      );
      return proyeccionPublica(reporte);
    }, reenvio);
  }
}
