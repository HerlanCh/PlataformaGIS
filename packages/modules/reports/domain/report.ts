import type { CategoryCode, GeoPoint, ReportId, UserId } from '@gis/shared-kernel';
import type { Category } from './category.js';
import {
  ExtensionLimitReachedError,
  InvalidIdempotencyKeyError,
  InvalidTransitionError,
  NotExpiredYetError,
} from './errors.js';
import { ExpirationPolicy, MAX_EXTENSIONS } from './expiration-policy.js';
import { PrivacyPolicy } from './privacy-policy.js';

export type ReportStatus = 'ACTIVO' | 'CONFIRMADO' | 'RESUELTO' | 'CADUCADO' | 'RECHAZADO';

/** `AUTOR_SILENCIADO` no penaliza de nuevo al autor (SRS 3.2.7). */
export type RejectionReason = 'MODERACION' | 'AUTOR_SILENCIADO';

// La genera el cliente (un UUID, normalmente); aquí solo se exige que sea opaca y acotada.
const CLAVE_DE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{8,128}$/;

/** Máquina de estados explícita: desde cada estado, a cuáles se puede pasar. */
export const TRANSITIONS: Readonly<Record<ReportStatus, readonly ReportStatus[]>> = {
  ACTIVO: ['CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO'],
  CONFIRMADO: ['RESUELTO', 'CADUCADO', 'RECHAZADO'],
  RESUELTO: [],
  CADUCADO: [],
  RECHAZADO: [],
};

/** Hechos ocurridos en el agregado. La capa de aplicación los traduce a eventos de integración. */
export type ReportEvent =
  | { readonly type: 'ReportCreated'; readonly occurredAt: Date }
  | { readonly type: 'ReportConfirmed'; readonly occurredAt: Date; readonly expiresAt: Date }
  | { readonly type: 'ReportExtended'; readonly occurredAt: Date; readonly expiresAt: Date }
  | { readonly type: 'ReportResolved'; readonly occurredAt: Date }
  | { readonly type: 'ReportExpired'; readonly occurredAt: Date }
  | {
      readonly type: 'ReportRejected';
      readonly occurredAt: Date;
      readonly reason: RejectionReason;
    };

export interface ReportProps {
  readonly id: ReportId;
  readonly categoryCode: CategoryCode;
  readonly authorId: UserId;
  /** Ubicación real. Nunca sale del servidor. */
  readonly location: GeoPoint;
  /** Ubicación que se muestra al público. */
  readonly publicLocation: GeoPoint;
  readonly status: ReportStatus;
  /** TTL original de la categoría al crear el reporte; base de las extensiones. */
  readonly ttlMinutes: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly extensions: number;
  readonly rejectionReason: RejectionReason | null;
  /** Clave que genera el cliente; evita duplicados al reenviar un reporte guardado sin conexión. */
  readonly idempotencyKey: string;
}

export interface CreateReportInput {
  readonly id: ReportId;
  readonly category: Category;
  readonly authorId: UserId;
  readonly location: GeoPoint;
  readonly idempotencyKey: string;
  readonly now: Date;
}

/** Agregado raíz: un incidente urbano georreferenciado y su ciclo de vida. */
export class Report {
  private readonly events: ReportEvent[] = [];

  private constructor(private props: ReportProps) {}

  /** Crea un reporte `ACTIVO` con su caducidad y su ubicación pública ya calculadas. */
  static create(input: CreateReportInput): Report {
    const { id, category, authorId, location, idempotencyKey, now } = input;
    if (!CLAVE_DE_IDEMPOTENCIA.test(idempotencyKey)) throw new InvalidIdempotencyKeyError();
    const report = new Report({
      id,
      categoryCode: category.code,
      authorId,
      location,
      publicLocation: PrivacyPolicy.publicLocation(location, category.isSensitive),
      status: 'ACTIVO',
      ttlMinutes: category.ttlMinutes,
      createdAt: now,
      expiresAt: ExpirationPolicy.initialExpiration(now, category.ttlMinutes),
      extensions: 0,
      rejectionReason: null,
      idempotencyKey,
    });
    report.events.push({ type: 'ReportCreated', occurredAt: now });
    return report;
  }

  /** Reconstruye un reporte ya persistido. No valida ni registra eventos. */
  static restore(props: ReportProps): Report {
    return new Report(props);
  }

  get id(): ReportId {
    return this.props.id;
  }

  get categoryCode(): CategoryCode {
    return this.props.categoryCode;
  }

  get authorId(): UserId {
    return this.props.authorId;
  }

  get location(): GeoPoint {
    return this.props.location;
  }

  get publicLocation(): GeoPoint {
    return this.props.publicLocation;
  }

  get status(): ReportStatus {
    return this.props.status;
  }

  get ttlMinutes(): number {
    return this.props.ttlMinutes;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get extensions(): number {
    return this.props.extensions;
  }

  get rejectionReason(): RejectionReason | null {
    return this.props.rejectionReason;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  /** Vigente: visible en el mapa y abierto a votos. */
  get isActive(): boolean {
    return this.props.status === 'ACTIVO' || this.props.status === 'CONFIRMADO';
  }

  /** `ACTIVO → CONFIRMADO`. Aplica la primera extensión de vigencia (SRS 3.2.4). */
  markConfirmed(now: Date): void {
    this.transitionTo('CONFIRMADO');
    const expiresAt = this.applyExtension();
    this.events.push({ type: 'ReportConfirmed', occurredAt: now, expiresAt });
  }

  /**
   * Extiende la vigencia de un reporte `CONFIRMADO` otro 50 % del TTL original.
   * @throws {ExtensionLimitReachedError} si ya usó sus extensiones.
   */
  extendExpiration(now: Date): void {
    if (this.props.status !== 'CONFIRMADO') {
      throw new InvalidTransitionError(this.props.status, 'una vigencia extendida');
    }
    if (this.props.extensions >= MAX_EXTENSIONS) throw new ExtensionLimitReachedError();
    const expiresAt = this.applyExtension();
    this.events.push({ type: 'ReportExtended', occurredAt: now, expiresAt });
  }

  /** `ACTIVO | CONFIRMADO → RESUELTO`, por negaciones de la comunidad. */
  markResolved(now: Date): void {
    this.transitionTo('RESUELTO');
    this.events.push({ type: 'ReportResolved', occurredAt: now });
  }

  /**
   * `ACTIVO | CONFIRMADO → CADUCADO` cuando su fecha de caducidad ya pasó.
   * @throws {NotExpiredYetError} si todavía está dentro de su vigencia.
   */
  expire(now: Date): void {
    this.assertCanTransitionTo('CADUCADO');
    if (!ExpirationPolicy.isExpired(this.props.expiresAt, now)) throw new NotExpiredYetError();
    this.props = { ...this.props, status: 'CADUCADO' };
    this.events.push({ type: 'ReportExpired', occurredAt: now });
  }

  /** `ACTIVO | CONFIRMADO → RECHAZADO`. */
  reject(reason: RejectionReason, now: Date): void {
    this.transitionTo('RECHAZADO');
    this.props = { ...this.props, rejectionReason: reason };
    this.events.push({ type: 'ReportRejected', occurredAt: now, reason });
  }

  /** Entrega los eventos pendientes y vacía la lista. */
  pullEvents(): ReportEvent[] {
    return this.events.splice(0);
  }

  private assertCanTransitionTo(hacia: ReportStatus): void {
    if (!TRANSITIONS[this.props.status].includes(hacia)) {
      throw new InvalidTransitionError(this.props.status, hacia);
    }
  }

  private transitionTo(hacia: ReportStatus): void {
    this.assertCanTransitionTo(hacia);
    this.props = { ...this.props, status: hacia };
  }

  private applyExtension(): Date {
    const expiresAt = ExpirationPolicy.extend(this.props.expiresAt, this.props.ttlMinutes);
    this.props = { ...this.props, expiresAt, extensions: this.props.extensions + 1 };
    return expiresAt;
  }
}
