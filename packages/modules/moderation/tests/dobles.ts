import type { EventoDeIntegracion } from '@gis/contracts';
import type { IdReporte } from '@gis/shared-kernel';
import type { UnidadDeTrabajoDeModeracion } from '../application/ports.js';
import type { AccionDeModeracion } from '../domain/accion-de-moderacion.js';
import { CasoDeModeracion, compararPrioridad } from '../domain/caso-de-moderacion.js';
import type {
  ConsultaDeReporte,
  DetalleDeReporte,
  EstadoDeReporte,
  RepositorioDeCola,
} from '../domain/ports.js';

/** Reportes de `reports` vistos por el puerto: solo su detalle. */
export class ReportesFalsos implements ConsultaDeReporte {
  readonly detalles = new Map<IdReporte, DetalleDeReporte>();

  poner(idReporte: IdReporte, estado: EstadoDeReporte, descripcion: string | null = null): void {
    this.detalles.set(idReporte, {
      idReporte,
      codigoCategoria: 'bloqueo',
      estado,
      descripcion,
      publicLocation: { latitud: -16.5, longitud: -68.15 },
      creadoEn: new Date('2026-10-19T12:00:00Z'),
    });
  }

  estadoDe(id: IdReporte): Promise<EstadoDeReporte | null> {
    return Promise.resolve(this.detalles.get(id)?.estado ?? null);
  }

  detallesDe(ids: readonly IdReporte[]): Promise<readonly DetalleDeReporte[]> {
    return Promise.resolve(ids.flatMap((id) => this.detalles.get(id) ?? []));
  }
}

const copiar = (caso: CasoDeModeracion): CasoDeModeracion =>
  CasoDeModeracion.restaurar({
    idReporte: caso.idReporte,
    negaciones: caso.negaciones,
    marcado: caso.marcado,
    motivos: [...caso.motivos],
    actualizadoEn: caso.actualizadoEn,
    resueltoEn: caso.resueltoEn,
  });

/** Mismo contrato que `RepositorioColaPg`. */
export class ColaEnMemoria implements RepositorioDeCola {
  readonly casos = new Map<IdReporte, CasoDeModeracion>();

  buscar(id: IdReporte): Promise<CasoDeModeracion | null> {
    const caso = this.casos.get(id);
    return Promise.resolve(caso ? copiar(caso) : null);
  }

  guardar(caso: CasoDeModeracion): Promise<void> {
    this.casos.set(caso.idReporte, copiar(caso));
    return Promise.resolve();
  }

  listarPendientes(limite: number): Promise<readonly CasoDeModeracion[]> {
    return Promise.resolve(
      [...this.casos.values()]
        .filter((c) => c.estaPendiente)
        .sort(compararPrioridad)
        .slice(0, limite)
        .map(copiar),
    );
  }
}

/** Anota las acciones y los eventos, y resuelve el caso como `UnidadDeTrabajoModeracionPg`. */
export class UnidadEnMemoria implements UnidadDeTrabajoDeModeracion {
  readonly acciones: AccionDeModeracion[] = [];
  readonly eventos: EventoDeIntegracion[] = [];

  constructor(private readonly cola = new ColaEnMemoria()) {}

  async registrar(
    accion: AccionDeModeracion,
    eventos: readonly EventoDeIntegracion[],
  ): Promise<void> {
    this.acciones.push(accion);
    this.eventos.push(...eventos);
    const caso = await this.cola.buscar(accion.idReporte);
    if (caso) {
      caso.resolver(accion.creadoEn);
      await this.cola.guardar(caso);
    }
  }
}
