// Almacenamiento local en IndexedDB, compartido por la página y el service worker: la sesión del
// dispositivo y la cola de reportes pendientes de envío. Así un reporte hecho sin señal sobrevive
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
}

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

interface Esquema extends DBSchema {
  sesion: { key: string; value: Sesion };
  cola: { key: string; value: ReportePendiente; indexes: { orden: number } };
}

const NOMBRE = 'alerta-lp';
let conexion: Promise<IDBPDatabase<Esquema>> | null = null;

export function abrirAlmacen(): Promise<IDBPDatabase<Esquema>> {
  conexion ??= openDB<Esquema>(NOMBRE, 1, {
    upgrade(db) {
      db.createObjectStore('sesion');
      db.createObjectStore('cola', { keyPath: 'clave' }).createIndex('orden', 'orden');
    },
  });
  return conexion;
}

/** Solo para pruebas: olvida la conexión para abrir una base nueva. */
export function reiniciarAlmacen(): void {
  conexion = null;
}
