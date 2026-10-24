import type { EventoDeIntegracion } from '@gis/contracts';
import { ErrorConflicto } from '@gis/shared-kernel';
import type {
  CajaGeografica,
  CodigoCategoria,
  IdReporte,
  IdUsuario,
  PuntoGeo,
} from '@gis/shared-kernel';
import { CLAVE_DE_IDEMPOTENCIA_REPETIDA } from '../application/ports.js';
import type { UnidadDeTrabajoDeReporte } from '../application/ports.js';
import { CATEGORIAS_MVP } from '../domain/category.js';
import type { Categoria } from '../domain/category.js';
import type {
  RepositorioDeCategorias,
  RepositorioDeReportes,
  ReputacionDelAutor,
} from '../domain/ports.js';
import { Reporte } from '../domain/report.js';
import type { EstadoReporte } from '../domain/report.js';
import { proyeccionPublica } from '../domain/reporte-publico.js';
import type { ReportePublico } from '../domain/reporte-publico.js';

/** Copia independiente: lo guardado no cambia si la prueba sigue usando el agregado. */
const copiar = (reporte: Reporte): Reporte =>
  Reporte.restaurar({
    id: reporte.id,
    codigoCategoria: reporte.codigoCategoria,
    authorId: reporte.authorId,
    location: reporte.location,
    publicLocation: reporte.publicLocation,
    estado: reporte.estado,
    ttlMinutos: reporte.ttlMinutos,
    creadoEn: reporte.creadoEn,
    caducaEn: reporte.caducaEn,
    extensiones: reporte.extensiones,
    motivoRechazo: reporte.motivoRechazo,
    idempotencyKey: reporte.idempotencyKey,
    descripcion: reporte.descripcion,
    fuenteOficial: reporte.fuenteOficial,
  });

const dentro = (punto: PuntoGeo, caja: CajaGeografica): boolean =>
  punto.latitud >= caja.latitudMin &&
  punto.latitud <= caja.latitudMax &&
  punto.longitud >= caja.longitudMin &&
  punto.longitud <= caja.longitudMax;

/** Mismo contrato que `RepositorioReportesPostgis`, con distancias haversine. */
export class RepositorioReportesEnMemoria implements RepositorioDeReportes {
  readonly filas = new Map<IdReporte, Reporte>();

  todos(): Reporte[] {
    return [...this.filas.values()].map(copiar);
  }

  buscarPorId(id: IdReporte): Promise<Reporte | null> {
    const fila = this.filas.get(id);
    return Promise.resolve(fila ? copiar(fila) : null);
  }

  buscarPorClaveDeIdempotencia(clave: string): Promise<Reporte | null> {
    const fila = [...this.filas.values()].find((r) => r.idempotencyKey === clave);
    return Promise.resolve(fila ? copiar(fila) : null);
  }

  buscarPorIds(ids: readonly IdReporte[]): Promise<readonly Reporte[]> {
    return Promise.resolve(this.todos().filter((r) => ids.includes(r.id)));
  }

  guardar(reporte: Reporte): Promise<void> {
    this.filas.set(reporte.id, copiar(reporte));
    return Promise.resolve();
  }

  buscarEnVentana(
    caja: CajaGeografica,
    categorias: readonly CodigoCategoria[],
    estados: readonly EstadoReporte[],
    limite: number,
  ): Promise<readonly ReportePublico[]> {
    const encontrados = this.todos()
      .filter((r) => dentro(r.publicLocation, caja) && estados.includes(r.estado))
      .filter((r) => categorias.length === 0 || categorias.includes(r.codigoCategoria))
      .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime())
      .slice(0, limite)
      .map(proyeccionPublica);
    return Promise.resolve(encontrados);
  }

  buscarCercanos(punto: PuntoGeo, radioM: number, limite: number): Promise<readonly Reporte[]> {
    return Promise.resolve(
      this.vigentes()
        .filter((r) => r.location.distanciaA(punto) <= radioM)
        .sort((a, b) => a.location.distanciaA(punto) - b.location.distanciaA(punto))
        .slice(0, limite),
    );
  }

  buscarDuplicado(categoria: Categoria, punto: PuntoGeo, ahora: Date): Promise<Reporte | null> {
    const [masCercano] = this.vigentes()
      .filter((r) => r.codigoCategoria === categoria.codigo && r.caducaEn > ahora)
      .filter((r) => r.location.distanciaA(punto) <= categoria.radioDuplicadoM)
      .sort((a, b) => a.location.distanciaA(punto) - b.location.distanciaA(punto));
    return Promise.resolve(masCercano ?? null);
  }

  buscarCaducados(ahora: Date, limite: number): Promise<readonly Reporte[]> {
    return Promise.resolve(
      this.vigentes()
        .filter((r) => r.caducaEn < ahora)
        .sort((a, b) => a.caducaEn.getTime() - b.caducaEn.getTime())
        .slice(0, limite),
    );
  }

  contarDelAutor(idAutor: IdUsuario, desde: Date, hasta: Date): Promise<number> {
    return Promise.resolve(
      this.todos().filter(
        (r) => r.authorId === idAutor && r.creadoEn >= desde && r.creadoEn <= hasta,
      ).length,
    );
  }

  buscarIdsFinalizados(despuesDe: IdReporte | null, limite: number): Promise<readonly IdReporte[]> {
    return Promise.resolve(
      this.todos()
        .filter((r) => !r.estaActivo && (despuesDe === null || r.id > despuesDe))
        .map((r) => r.id)
        .sort()
        .slice(0, limite),
    );
  }

  private vigentes(): Reporte[] {
    return this.todos().filter((r) => r.estaActivo);
  }
}

/** Guarda en el repositorio y anota los eventos, como el outbox. */
export class UnidadDeTrabajoEnMemoria implements UnidadDeTrabajoDeReporte {
  readonly eventos: EventoDeIntegracion[] = [];

  constructor(private readonly reportes: RepositorioReportesEnMemoria) {}

  async confirmar(reporte: Reporte, eventos: readonly EventoDeIntegracion[]): Promise<void> {
    const otro = await this.reportes.buscarPorClaveDeIdempotencia(reporte.idempotencyKey);
    if (otro && otro.id !== reporte.id) {
      throw new ErrorConflicto(CLAVE_DE_IDEMPOTENCIA_REPETIDA, 'clave repetida');
    }
    await this.reportes.guardar(reporte);
    this.eventos.push(...eventos);
  }

  registrarEventos(eventos: readonly EventoDeIntegracion[]): Promise<void> {
    this.eventos.push(...eventos);
    return Promise.resolve();
  }

  /** Tipos de los eventos guardados, en orden: `['ReporteCreado', ...]`. */
  tipos(): string[] {
    return this.eventos.map((evento) => evento.tipo);
  }
}

export class CategoriasEnMemoria implements RepositorioDeCategorias {
  buscarPorCodigo(codigo: CodigoCategoria): Promise<Categoria | null> {
    return Promise.resolve(CATEGORIAS_MVP.find((c) => c.codigo === codigo) ?? null);
  }

  buscarTodas(): Promise<readonly Categoria[]> {
    return Promise.resolve(CATEGORIAS_MVP);
  }
}

export class ReputacionFalsa implements ReputacionDelAutor {
  readonly silenciados = new Set<IdUsuario>();

  estaSilenciado(idAutor: IdUsuario): Promise<boolean> {
    return Promise.resolve(this.silenciados.has(idAutor));
  }
}
