// Memoria del dispositivo sobre los reportes: los propios, los votados y por cuáles ya se preguntó
// «¿Sigue ahí?». Vive en IndexedDB para que también la use el service worker al enviar la cola.
import { abrirAlmacen } from './almacen.js';
import type { Recuerdo } from './almacen.js';

export type { Recuerdo };

/** Agrega datos al recuerdo de un reporte sin borrar los que ya tenía. */
export async function recordar(
  idReporte: string,
  cambios: Omit<Recuerdo, 'idReporte'>,
): Promise<void> {
  const db = await abrirAlmacen();
  const anterior = await db.get('memoria', idReporte);
  await db.put('memoria', { ...anterior, ...cambios, idReporte });
}

/** Todos los recuerdos, por id de reporte. */
export async function leerMemoria(): Promise<ReadonlyMap<string, Recuerdo>> {
  const todos = await (await abrirAlmacen()).getAll('memoria');
  return new Map(todos.map((r) => [r.idReporte, r]));
}
