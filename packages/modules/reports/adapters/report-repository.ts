import type { Ejecutor } from '@gis/platform';
import { codigoCategoria, PuntoGeo, idReporte, idUsuario } from '@gis/shared-kernel';
import type { IdReporte } from '@gis/shared-kernel';
import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { RepositorioDeReportes } from '../domain/ports.js';
import { Reporte } from '../domain/report.js';
import type { MotivoRechazo, EstadoReporte } from '../domain/report.js';
import { reportes } from './schema.js';

type Fila = typeof reportes.$inferSelect;
type Punto = Fila['location'];

// En PostGIS x es la longitud e y la latitud.
const aPunto = (punto: PuntoGeo): Punto => ({ x: punto.longitud, y: punto.latitud });
const aPuntoGeo = (punto: Punto): PuntoGeo => PuntoGeo.crear(punto.y, punto.x);

/** Mapeo explícito fila → agregado: el dominio nunca ve tipos de Drizzle. */
const aAgregado = (fila: Fila): Reporte =>
  Reporte.restaurar({
    id: idReporte(fila.id),
    codigoCategoria: codigoCategoria(fila.codigoCategoria),
    authorId: idUsuario(fila.authorId),
    location: aPuntoGeo(fila.location),
    publicLocation: aPuntoGeo(fila.publicLocation),
    estado: fila.estado as EstadoReporte,
    ttlMinutos: fila.ttlMinutos,
    creadoEn: fila.creadoEn,
    caducaEn: fila.caducaEn,
    extensiones: fila.extensiones,
    motivoRechazo: fila.motivoRechazo as MotivoRechazo | null,
    idempotencyKey: fila.idempotencyKey,
  });

/** Las consultas espaciales (viewport, cercanía, duplicados, vencidos) se añaden en la Fase 4. */
export class RepositorioReportesPostgis implements RepositorioDeReportes {
  constructor(private readonly db: Ejecutor) {}

  buscarPorId(id: IdReporte): Promise<Reporte | null> {
    return this.buscar(eq(reportes.id, id));
  }

  buscarPorClaveDeIdempotencia(claveDeIdempotencia: string): Promise<Reporte | null> {
    return this.buscar(eq(reportes.idempotencyKey, claveDeIdempotencia));
  }

  async guardar(reporte: Reporte): Promise<void> {
    const mutables = {
      estado: reporte.estado,
      caducaEn: reporte.caducaEn,
      extensiones: reporte.extensiones,
      motivoRechazo: reporte.motivoRechazo,
    };
    await this.db
      .insert(reportes)
      .values({
        id: reporte.id,
        codigoCategoria: reporte.codigoCategoria,
        authorId: reporte.authorId,
        ttlMinutos: reporte.ttlMinutos,
        creadoEn: reporte.creadoEn,
        location: aPunto(reporte.location),
        // Se guarda la ubicación pública que decidió el dominio, sin recalcularla.
        publicLocation: aPunto(reporte.publicLocation),
        idempotencyKey: reporte.idempotencyKey,
        ...mutables,
      })
      // Tras la creación solo cambia el ciclo de vida; las ubicaciones y el autor son fijos.
      .onConflictDoUpdate({ target: reportes.id, set: mutables });
  }

  private async buscar(condicion: SQL): Promise<Reporte | null> {
    const [fila] = await this.db.select().from(reportes).where(condicion).limit(1);
    return fila ? aAgregado(fila) : null;
  }
}
