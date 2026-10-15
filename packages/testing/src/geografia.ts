import { PuntoGeo } from '@gis/shared-kernel';

const METROS_POR_GRADO = 111_195;

/**
 * Punto a `norteM` metros al norte y `esteM` metros al este del origen. Es una aproximación
 * plana, con un error de centímetros a estas distancias: sirve para pruebas, no para el dominio.
 */
export const desplazar = (origen: PuntoGeo, norteM: number, esteM: number): PuntoGeo =>
  PuntoGeo.crear(
    origen.latitud + norteM / METROS_POR_GRADO,
    origen.longitud + esteM / (METROS_POR_GRADO * Math.cos((origen.latitud * Math.PI) / 180)),
  );
