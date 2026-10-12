import type { Ejecutor } from '@gis/platform';
import { codigoCategoria, PuntoGeo, idUsuario } from '@gis/shared-kernel';
import type { IdUsuario } from '@gis/shared-kernel';
import { asc, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { RepositorioDeSuscripciones } from '../domain/ports.js';
import { idSuscripcion, ZonaSuscrita } from '../domain/zone-subscription.js';
import type { IdSuscripcion } from '../domain/zone-subscription.js';
import { zonasSuscritas } from './schema.js';

// En PostGIS x es la longitud e y la latitud.
const columnas = {
  id: zonasSuscritas.id,
  idUsuario: zonasSuscritas.idUsuario,
  latitud: sql<number>`st_y(${zonasSuscritas.centro}::geometry)`,
  longitud: sql<number>`st_x(${zonasSuscritas.centro}::geometry)`,
  radioM: zonasSuscritas.radioM,
  categorias: zonasSuscritas.categorias,
  creadoEn: zonasSuscritas.creadoEn,
};

interface Fila {
  readonly id: string;
  readonly idUsuario: string;
  readonly latitud: number;
  readonly longitud: number;
  readonly radioM: number;
  readonly categorias: string[];
  readonly creadoEn: Date;
}

const aGeography = (punto: PuntoGeo): SQL =>
  sql`st_setsrid(st_makepoint(${punto.longitud}, ${punto.latitud}), 4326)::geography`;

/** Mapeo explícito fila → entidad: el dominio nunca ve tipos de Drizzle. */
const aEntidad = (fila: Fila): ZonaSuscrita =>
  ZonaSuscrita.restaurar({
    id: idSuscripcion(fila.id),
    idUsuario: idUsuario(fila.idUsuario),
    centro: PuntoGeo.crear(fila.latitud, fila.longitud),
    radioM: fila.radioM,
    categorias: fila.categorias.map(codigoCategoria),
    creadoEn: fila.creadoEn,
  });

export class RepositorioSuscripcionesPg implements RepositorioDeSuscripciones {
  constructor(private readonly db: Ejecutor) {}

  async buscarPorId(id: IdSuscripcion): Promise<ZonaSuscrita | null> {
    const [fila] = await this.db
      .select(columnas)
      .from(zonasSuscritas)
      .where(eq(zonasSuscritas.id, id))
      .limit(1);
    return fila ? aEntidad(fila) : null;
  }

  async buscarPorUsuario(id: IdUsuario): Promise<readonly ZonaSuscrita[]> {
    const filas = await this.db
      .select(columnas)
      .from(zonasSuscritas)
      .where(eq(zonasSuscritas.idUsuario, id))
      .orderBy(asc(zonasSuscritas.creadoEn), asc(zonasSuscritas.id));
    return filas.map(aEntidad);
  }

  /** Una zona es inmutable: para cambiarla se elimina y se crea otra. */
  async guardar(zona: ZonaSuscrita): Promise<void> {
    await this.db.insert(zonasSuscritas).values({
      id: zona.id,
      idUsuario: zona.idUsuario,
      centro: aGeography(zona.centro),
      radioM: zona.radioM,
      categorias: [...zona.categorias],
      creadoEn: zona.creadoEn,
    });
  }

  async eliminar(id: IdSuscripcion): Promise<boolean> {
    const borradas = await this.db
      .delete(zonasSuscritas)
      .where(eq(zonasSuscritas.id, id))
      .returning({ id: zonasSuscritas.id });
    return borradas.length > 0;
  }
}
