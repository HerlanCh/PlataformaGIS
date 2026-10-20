// Almacenamiento local en IndexedDB, compartido por la página y el service worker: la sesión del
// dispositivo, la cola de reportes pendientes de envío y la memoria de lo que hizo el dispositivo. Así un reporte hecho sin señal sobrevive
// a cerrar la app y el service worker puede enviarlo con Background Sync.
import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export interface Sesion {
  /** Identificador anónimo del dispositivo; no contiene datos personales. */
  readonly hashDispositivo: string;
  readonly idUsuario: string | null;
  readonly token: string | null;
  /** Momento en que vence el token (ISO). */
  readonly expiraEn: string | null;
  /** Rol de la última credencial. Falta en las sesiones guardadas antes de la Fase 10. */
  readonly rol?: Rol;
}

export type Rol = 'CIUDADANO' | 'MODERADOR';

export interface ReportePendiente {
  /** También es la `Idempotency-Key`: un reenvío nunca crea otro reporte. */
  readonly clave: string;
  readonly codigoCategoria: string;
  readonly latitud: number;
  readonly longitud: number;
  readonly creadoEn: string;
  /** Orden de llegada, estricto aunque dos reportes coincidan en el mismo milisegundo. */
  readonly orden: number;
  readonly intentos: number;
}

/**
 * Lo que este dispositivo hizo con un reporte. Es memoria local, no un dato del servidor: así la
 * app sabe qué reportes son propios sin que la API exponga nunca al autor.
 */
export interface Recuerdo {
  readonly idReporte: string;
  readonly propio?: true;
  readonly voto?: 'CONFIRMACION' | 'NEGACION';
  /** Ya se le preguntó «¿Sigue ahí?» por este reporte. */
  readonly preguntado?: true;
}

interface Esquema extends DBSchema {
  sesion: { key: string; value: Sesion };
  cola: { key: string; value: ReportePendiente; indexes: { orden: number } };
  memoria: { key: string; value: Recuerdo };
}

const NOMBRE = 'alerta-lp';
let conexion: Promise<IDBPDatabase<Esquema>> | null = null;

export function abrirAlmacen(): Promise<IDBPDatabase<Esquema>> {
  conexion ??= openDB<Esquema>(NOMBRE, 2, {
    upgrade(db, versionAnterior) {
      if (versionAnterior < 1) {
        db.createObjectStore('sesion');
        db.createObjectStore('cola', { keyPath: 'clave' }).createIndex('orden', 'orden');
      }
      if (versionAnterior < 2) db.createObjectStore('memoria', { keyPath: 'idReporte' });
    },
  });
  return conexion;
}

/** Solo para pruebas: olvida la conexión para abrir una base nueva. */
export function reiniciarAlmacen(): void {
  conexion = null;
}
