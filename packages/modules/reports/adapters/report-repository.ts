import type { Ejecutor } from '@gis/platform';
import { codigoCategoria, PuntoGeo, idReporte, idUsuario } from '@gis/shared-kernel';
import type { CajaGeografica, CodigoCategoria, IdReporte } from '@gis/shared-kernel';
import { and, asc, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Categoria } from '../domain/category.js';
import type { RepositorioDeReportes } from '../domain/ports.js';
import { Reporte } from '../domain/report.js';
import type { MotivoRechazo, EstadoReporte } from '../domain/report.js';
import type { ReportePublico } from '../domain/reporte-publico.js';
import { reportes } from './schema.js';

type Fila = typeof reportes.$inferSelect;
type Punto = Fila['location'];

// En PostGIS x es la longitud e y la latitud.
const aPunto = (punto: PuntoGeo): Punto => ({ x: punto.longitud, y: punto.latitud });
const aPuntoGeo = (punto: Punto): PuntoGeo => PuntoGeo.crear(punto.y, punto.x);

const ESTADOS_VIGENTES: readonly EstadoReporte[] = ['ACTIVO', 'CONFIRMADO'];

// Punto como geography: las distancias se miden en metros sobre el elipsoide.
const aGeography = (punto: PuntoGeo): SQL =>
  sql`st_setsrid(st_makepoint(${punto.longitud}, ${punto.latitud}), 4326)::geography`;

function validarLimite(limite: number): void {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new RangeError('El límite debe ser un entero positivo');
  }
}

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

  async buscarEnVentana(
    caja: CajaGeografica,
    categorias: readonly CodigoCategoria[],
    estados: readonly EstadoReporte[],
    limite: number,
  ): Promise<readonly ReportePublico[]> {
    if (estados.length === 0) throw new RangeError('Hay que indicar al menos un estado');
    validarLimite(limite);
    const filtros: (SQL | undefined)[] = [
      // `&&` usa el índice GiST de `ubicacion_publica`; una caja con el punto en su borde lo incluye.
      sql`${reportes.publicLocation} && st_makeenvelope(${caja.longitudMin}, ${caja.latitudMin}, ${caja.longitudMax}, ${caja.latitudMax}, 4326)`,
      categorias.length > 0 ? inArray(reportes.codigoCategoria, [...categorias]) : undefined,
      inArray(reportes.estado, [...estados]),
    ];
    const filas = await this.db
      .select({
        id: reportes.id,
        codigoCategoria: reportes.codigoCategoria,
        estado: reportes.estado,
        latitud: sql<number>`st_y(${reportes.publicLocation})`,
        longitud: sql<number>`st_x(${reportes.publicLocation})`,
        creadoEn: reportes.creadoEn,
        caducaEn: reportes.caducaEn,
      })
      .from(reportes)
      .where(and(...filtros))
      .orderBy(desc(reportes.creadoEn), asc(reportes.id))
      .limit(limite);

    return filas.map((fila) => ({
      id: idReporte(fila.id),
      codigoCategoria: codigoCategoria(fila.codigoCategoria),
      estado: fila.estado as EstadoReporte,
      publicLocation: PuntoGeo.crear(fila.latitud, fila.longitud),
      creadoEn: fila.creadoEn,
      caducaEn: fila.caducaEn,
    }));
  }

  async buscarCercanos(
    punto: PuntoGeo,
    radioM: number,
    limite: number,
  ): Promise<readonly Reporte[]> {
    if (Number.isNaN(radioM) || radioM <= 0) {
      throw new RangeError('El radio debe ser un número positivo de metros');
    }
    validarLimite(limite);
    const filas = await this.db
      .select()
      .from(reportes)
      .where(
        and(
          inArray(reportes.estado, [...ESTADOS_VIGENTES]),
          sql`st_dwithin(${reportes.location}::geography, ${aGeography(punto)}, ${radioM})`,
        ),
      )
      .orderBy(sql`st_distance(${reportes.location}::geography, ${aGeography(punto)})`)
      .limit(limite);
    return filas.map(aAgregado);
  }

  async buscarDuplicado(
    categoria: Categoria,
    punto: PuntoGeo,
    ahora: Date,
  ): Promise<Reporte | null> {
    const [fila] = await this.db
      .select()
      .from(reportes)
      .where(
        and(
          eq(reportes.codigoCategoria, categoria.codigo),
          inArray(reportes.estado, [...ESTADOS_VIGENTES]),
          gt(reportes.caducaEn, ahora),
          sql`st_dwithin(${reportes.location}::geography, ${aGeography(punto)}, ${categoria.radioDuplicadoM})`,
        ),
      )
      .orderBy(sql`st_distance(${reportes.location}::geography, ${aGeography(punto)})`)
      .limit(1);
    return fila ? aAgregado(fila) : null;
  }

  async buscarCaducados(ahora: Date, limite: number): Promise<readonly Reporte[]> {
    validarLimite(limite);
    const filas = await this.db
      .select()
      .from(reportes)
      .where(and(inArray(reportes.estado, [...ESTADOS_VIGENTES]), lt(reportes.caducaEn, ahora)))
      .orderBy(asc(reportes.caducaEn), asc(reportes.id))
      .limit(limite);
    return filas.map(aAgregado);
  }

  private async buscar(condicion: SQL): Promise<Reporte | null> {
    const [fila] = await this.db.select().from(reportes).where(condicion).limit(1);
    return fila ? aAgregado(fila) : null;
  }
}
