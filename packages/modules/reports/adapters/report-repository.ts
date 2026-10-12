import type { Executor } from '@gis/platform';
import { categoryCode, GeoPoint, reportId, userId } from '@gis/shared-kernel';
import type { ReportId } from '@gis/shared-kernel';
import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { ReportRepository } from '../domain/ports.js';
import { Report } from '../domain/report.js';
import type { RejectionReason, ReportStatus } from '../domain/report.js';
import { reports } from './schema.js';

type Fila = typeof reports.$inferSelect;
type Punto = Fila['location'];

// En PostGIS x es la longitud e y la latitud.
const aPunto = (punto: GeoPoint): Punto => ({ x: punto.longitude, y: punto.latitude });
const aGeoPoint = (punto: Punto): GeoPoint => GeoPoint.create(punto.y, punto.x);

/** Mapeo explícito fila → agregado: el dominio nunca ve tipos de Drizzle. */
const aAgregado = (fila: Fila): Report =>
  Report.restore({
    id: reportId(fila.id),
    categoryCode: categoryCode(fila.categoryCode),
    authorId: userId(fila.authorId),
    location: aGeoPoint(fila.location),
    publicLocation: aGeoPoint(fila.publicLocation),
    status: fila.status as ReportStatus,
    ttlMinutes: fila.ttlMinutes,
    createdAt: fila.createdAt,
    expiresAt: fila.expiresAt,
    extensions: fila.extensions,
    rejectionReason: fila.rejectionReason as RejectionReason | null,
    idempotencyKey: fila.idempotencyKey,
  });

/** Las consultas espaciales (viewport, cercanía, duplicados, vencidos) se añaden en la Fase 4. */
export class PostgisReportRepository implements ReportRepository {
  constructor(private readonly db: Executor) {}

  findById(id: ReportId): Promise<Report | null> {
    return this.buscar(eq(reports.id, id));
  }

  findByIdempotencyKey(idempotencyKey: string): Promise<Report | null> {
    return this.buscar(eq(reports.idempotencyKey, idempotencyKey));
  }

  async save(report: Report): Promise<void> {
    const mutables = {
      status: report.status,
      expiresAt: report.expiresAt,
      extensions: report.extensions,
      rejectionReason: report.rejectionReason,
    };
    await this.db
      .insert(reports)
      .values({
        id: report.id,
        categoryCode: report.categoryCode,
        authorId: report.authorId,
        ttlMinutes: report.ttlMinutes,
        createdAt: report.createdAt,
        location: aPunto(report.location),
        // Se guarda la ubicación pública que decidió el dominio, sin recalcularla.
        publicLocation: aPunto(report.publicLocation),
        idempotencyKey: report.idempotencyKey,
        ...mutables,
      })
      // Tras la creación solo cambia el ciclo de vida; las ubicaciones y el autor son fijos.
      .onConflictDoUpdate({ target: reports.id, set: mutables });
  }

  private async buscar(condicion: SQL): Promise<Report | null> {
    const [fila] = await this.db.select().from(reports).where(condicion).limit(1);
    return fila ? aAgregado(fila) : null;
  }
}
