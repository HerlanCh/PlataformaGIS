import { CLAVES_REPORTE_CREADO, leerReporteCreado } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import { codigoCategoria, idReporte, PuntoGeo } from '@gis/shared-kernel';
import type { IdUsuario } from '@gis/shared-kernel';
import type { RepositorioDeSuscripciones } from '../domain/ports.js';
import type { ConsultaDeAutor, EnviadorDeNotificaciones } from './ports.js';

export interface DependenciasNotificarSuscriptores {
  readonly suscripciones: RepositorioDeSuscripciones;
  readonly consultaDeAutor: ConsultaDeAutor;
  readonly enviador: EnviadorDeNotificaciones;
}

/**
 * Manejador de `ReporteCreado` (HU-08): avisa a quien tiene una zona suscrita que contiene el
 * reporte y eligió su categoría. Solo reacciona a la creación, así cada reporte se avisa una vez
 * (escenario 3). Se busca con la ubicación pública, la única que viaja en el evento.
 */
export class NotificarSuscriptores {
  static readonly eventos = CLAVES_REPORTE_CREADO;

  constructor(private readonly deps: DependenciasNotificarSuscriptores) {}

  /** Devuelve a cuántos usuarios avisó. */
  async manejar(evento: EventoDeIntegracion): Promise<number> {
    const contenido = leerReporteCreado(evento);
    const id = idReporte(contenido.idReporte);
    const categoria = codigoCategoria(contenido.codigoCategoria);
    const punto = PuntoGeo.crear(
      contenido.publicLocation.latitud,
      contenido.publicLocation.longitud,
    );

    const [zonas, autor] = await Promise.all([
      this.deps.suscripciones.buscarSuscriptores(punto, categoria),
      this.deps.consultaDeAutor.autorDe(id),
    ]);
    // Un aviso por persona aunque varias de sus zonas cubran el punto; nunca al autor (escenario 4).
    const destinatarios = new Set<IdUsuario>(zonas.map((zona) => zona.idUsuario));
    if (autor) destinatarios.delete(autor);

    // El fallo de un envío no impide los demás; después se informa el primero.
    const envios = await Promise.allSettled(
      [...destinatarios].map((idUsuario) =>
        this.deps.enviador.enviar({
          idUsuario,
          idReporte: id,
          codigoCategoria: categoria,
          publicLocation: punto,
        }),
      ),
    );
    const fallido = envios.find((envio) => envio.status === 'rejected');
    if (fallido) throw fallido.reason;
    return destinatarios.size;
  }
}
