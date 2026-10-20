import type { CodigoCategoria, PuntoGeo, IdReporte, IdUsuario } from '@gis/shared-kernel';
import type { Categoria } from './category.js';
import {
  ErrorLimiteDeExtensiones,
  ErrorClaveDeIdempotenciaInvalida,
  ErrorTransicionInvalida,
  ErrorAunNoCaduca,
  ErrorDescripcionInvalida,
  ErrorDescripcionYaAgregada,
  ErrorNoEsElAutor,
  ErrorReporteNoVigente,
} from './errors.js';
import { PoliticaDeCaducidad, MAX_EXTENSIONES } from './expiration-policy.js';
import { PoliticaDePrivacidad } from './privacy-policy.js';

export type EstadoReporte = 'ACTIVO' | 'CONFIRMADO' | 'RESUELTO' | 'CADUCADO' | 'RECHAZADO';

/** `AUTOR_SILENCIADO` no penaliza de nuevo al autor (SRS 3.2.7). */
export type MotivoRechazo = 'MODERACION' | 'AUTOR_SILENCIADO';

// La genera el cliente (un UUID, normalmente); aquí solo se exige que sea opaca y acotada.
const CLAVE_DE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{8,128}$/;

export const esClaveDeIdempotenciaValida = (clave: string): boolean =>
  CLAVE_DE_IDEMPOTENCIA.test(clave);

/** Caracteres máximos de la descripción, contados como `char_length` de PostgreSQL. */
export const MAX_DESCRIPCION = 280;

/** Máquina de estados explícita: desde cada estado, a cuáles se puede pasar. */
export const TRANSICIONES: Readonly<Record<EstadoReporte, readonly EstadoReporte[]>> = {
  ACTIVO: ['CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO'],
  CONFIRMADO: ['RESUELTO', 'CADUCADO', 'RECHAZADO'],
  RESUELTO: [],
  CADUCADO: [],
  RECHAZADO: [],
};

/** Hechos ocurridos en el agregado. La capa de aplicación los traduce a eventos de integración. */
export type EventoReporte =
  | { readonly tipo: 'ReporteCreado'; readonly ocurridoEn: Date }
  | { readonly tipo: 'ReporteConfirmado'; readonly ocurridoEn: Date; readonly caducaEn: Date }
  | { readonly tipo: 'ReporteExtendido'; readonly ocurridoEn: Date; readonly caducaEn: Date }
  | { readonly tipo: 'ReporteResuelto'; readonly ocurridoEn: Date }
  | { readonly tipo: 'ReporteCaducado'; readonly ocurridoEn: Date }
  | { readonly tipo: 'DescripcionAgregada'; readonly ocurridoEn: Date }
  | {
      readonly tipo: 'ReporteRechazado';
      readonly ocurridoEn: Date;
      readonly motivo: MotivoRechazo;
    };

export interface PropsReporte {
  readonly id: IdReporte;
  readonly codigoCategoria: CodigoCategoria;
  readonly authorId: IdUsuario;
  /** Ubicación real. Nunca sale del servidor. */
  readonly location: PuntoGeo;
  /** Ubicación que se muestra al público. */
  readonly publicLocation: PuntoGeo;
  readonly estado: EstadoReporte;
  /** TTL original de la categoría al crear el reporte; base de las extensiones. */
  readonly ttlMinutos: number;
  readonly creadoEn: Date;
  readonly caducaEn: Date;
  readonly extensiones: number;
  readonly motivoRechazo: MotivoRechazo | null;
  /** Clave que genera el cliente; evita duplicados al reenviar un reporte guardado sin conexión. */
  readonly idempotencyKey: string;
  /** Texto opcional del autor. Privado: solo lo leen el clasificador y los moderadores. */
  readonly descripcion: string | null;
}

export interface EntradaCrearReporte {
  readonly id: IdReporte;
  readonly categoria: Categoria;
  readonly authorId: IdUsuario;
  readonly location: PuntoGeo;
  readonly idempotencyKey: string;
  readonly ahora: Date;
}

/** Agregado raíz: un incidente urbano georreferenciado y su ciclo de vida. */
export class Reporte {
  private readonly eventos: EventoReporte[] = [];

  private constructor(private props: PropsReporte) {}

  /** Crea un reporte `ACTIVO` con su caducidad y su ubicación pública ya calculadas. */
  static crear(input: EntradaCrearReporte): Reporte {
    const { id, categoria: category, authorId, location, idempotencyKey, ahora: ahora } = input;
    if (!esClaveDeIdempotenciaValida(idempotencyKey)) throw new ErrorClaveDeIdempotenciaInvalida();
    const reporte = new Reporte({
      id,
      codigoCategoria: category.codigo,
      authorId,
      location,
      publicLocation: PoliticaDePrivacidad.ubicacionPublica(location, category.esSensible),
      estado: 'ACTIVO',
      ttlMinutos: category.ttlMinutos,
      creadoEn: ahora,
      caducaEn: PoliticaDeCaducidad.caducidadInicial(ahora, category.ttlMinutos),
      extensiones: 0,
      motivoRechazo: null,
      idempotencyKey,
      descripcion: null,
    });
    reporte.eventos.push({ tipo: 'ReporteCreado', ocurridoEn: ahora });
    return reporte;
  }

  /** Reconstruye un reporte ya persistido. No valida ni registra eventos. */
  static restaurar(props: PropsReporte): Reporte {
    return new Reporte(props);
  }

  get id(): IdReporte {
    return this.props.id;
  }

  get codigoCategoria(): CodigoCategoria {
    return this.props.codigoCategoria;
  }

  get authorId(): IdUsuario {
    return this.props.authorId;
  }

  get location(): PuntoGeo {
    return this.props.location;
  }

  get publicLocation(): PuntoGeo {
    return this.props.publicLocation;
  }

  get estado(): EstadoReporte {
    return this.props.estado;
  }

  get ttlMinutos(): number {
    return this.props.ttlMinutos;
  }

  get creadoEn(): Date {
    return this.props.creadoEn;
  }

  get caducaEn(): Date {
    return this.props.caducaEn;
  }

  get extensiones(): number {
    return this.props.extensiones;
  }

  get motivoRechazo(): MotivoRechazo | null {
    return this.props.motivoRechazo;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get descripcion(): string | null {
    return this.props.descripcion;
  }

  /** Vigente: visible en el mapa y abierto a votos. */
  get estaActivo(): boolean {
    return this.props.estado === 'ACTIVO' || this.props.estado === 'CONFIRMADO';
  }

  /** `ACTIVO → CONFIRMADO`. Aplica la primera extensión de vigencia (SRS 3.2.4). */
  marcarConfirmado(ahora: Date): void {
    this.transicionarA('CONFIRMADO');
    const caducaEn = this.aplicarExtension();
    this.eventos.push({ tipo: 'ReporteConfirmado', ocurridoEn: ahora, caducaEn });
  }

  /**
   * Extiende la vigencia de un reporte `CONFIRMADO` otro 50 % del TTL original.
   * @throws {ErrorLimiteDeExtensiones} si ya usó sus extensiones.
   */
  extenderCaducidad(ahora: Date): void {
    if (this.props.estado !== 'CONFIRMADO') {
      throw new ErrorTransicionInvalida(this.props.estado, 'una vigencia extendida');
    }
    if (this.props.extensiones >= MAX_EXTENSIONES) throw new ErrorLimiteDeExtensiones();
    const caducaEn = this.aplicarExtension();
    this.eventos.push({ tipo: 'ReporteExtendido', ocurridoEn: ahora, caducaEn });
  }

  /** `ACTIVO | CONFIRMADO → RESUELTO`, por negaciones de la comunidad. */
  marcarResuelto(ahora: Date): void {
    this.transicionarA('RESUELTO');
    this.eventos.push({ tipo: 'ReporteResuelto', ocurridoEn: ahora });
  }

  /**
   * `ACTIVO | CONFIRMADO → CADUCADO` cuando su fecha de caducidad ya pasó.
   * @throws {ErrorAunNoCaduca} si todavía está dentro de su vigencia.
   */
  caducar(ahora: Date): void {
    this.asegurarTransicionA('CADUCADO');
    if (!PoliticaDeCaducidad.haCaducado(this.props.caducaEn, ahora)) throw new ErrorAunNoCaduca();
    this.props = { ...this.props, estado: 'CADUCADO' };
    this.eventos.push({ tipo: 'ReporteCaducado', ocurridoEn: ahora });
  }

  /** `ACTIVO | CONFIRMADO → RECHAZADO`. */
  rechazar(motivo: MotivoRechazo, ahora: Date): void {
    this.transicionarA('RECHAZADO');
    this.props = { ...this.props, motivoRechazo: motivo };
    this.eventos.push({ tipo: 'ReporteRechazado', ocurridoEn: ahora, motivo });
  }

  /**
   * El autor describe su reporte vigente, una sola vez. Se recortan los espacios de los extremos.
   * @throws {ErrorNoEsElAutor} si lo intenta otro usuario.
   * @throws {ErrorReporteNoVigente} si el reporte ya no está `ACTIVO` ni `CONFIRMADO`.
   * @throws {ErrorDescripcionYaAgregada} si ya tiene descripción.
   * @throws {ErrorDescripcionInvalida} si queda vacía o supera `MAX_DESCRIPCION` caracteres.
   */
  agregarDescripcion(texto: string, idAutor: IdUsuario, ahora: Date): void {
    if (idAutor !== this.props.authorId) throw new ErrorNoEsElAutor();
    if (!this.estaActivo) throw new ErrorReporteNoVigente(this.props.estado);
    if (this.props.descripcion !== null) throw new ErrorDescripcionYaAgregada();
    const descripcion = texto.trim();
    // Se cuentan puntos de código, como `char_length`: un emoji es un carácter.
    const largo = [...descripcion].length;
    if (largo === 0 || largo > MAX_DESCRIPCION) {
      throw new ErrorDescripcionInvalida(MAX_DESCRIPCION);
    }
    this.props = { ...this.props, descripcion };
    this.eventos.push({ tipo: 'DescripcionAgregada', ocurridoEn: ahora });
  }

  /** Entrega los eventos pendientes y vacía la lista. */
  extraerEventos(): EventoReporte[] {
    return this.eventos.splice(0);
  }

  private asegurarTransicionA(hacia: EstadoReporte): void {
    if (!TRANSICIONES[this.props.estado].includes(hacia)) {
      throw new ErrorTransicionInvalida(this.props.estado, hacia);
    }
  }

  private transicionarA(hacia: EstadoReporte): void {
    this.asegurarTransicionA(hacia);
    this.props = { ...this.props, estado: hacia };
  }

  private aplicarExtension(): Date {
    const caducaEn = PoliticaDeCaducidad.extender(this.props.caducaEn, this.props.ttlMinutos);
    this.props = { ...this.props, caducaEn: caducaEn, extensiones: this.props.extensiones + 1 };
    return caducaEn;
  }
}
