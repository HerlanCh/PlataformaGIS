// Cola sin conexión (HU-05): cada reporte se guarda primero aquí y luego se envía. Si no hay señal,
// queda pendiente y se reenvía al recuperar conexión, con Background Sync o con el evento `online`.
// La clave de idempotencia evita duplicados aunque el mismo reporte se envíe más de una vez.
import { abrirAlmacen } from './almacen.js';
import type { ReportePendiente } from './almacen.js';
import { recordar } from './memoria.js';
import { esRechazo, JSON_CABECERA, pedirConToken, rechazoDe } from './peticion.js';
import type { Rechazo } from './peticion.js';

export type { ReportePendiente };

export type Resultado =
  | { readonly tipo: 'CREADO' | 'DUPLICADO' | 'PROPIO_EXISTENTE'; readonly idReporte: string }
  | Rechazo
  | { readonly tipo: 'PENDIENTE' };

export interface ResultadoDeEnvio {
  readonly pendiente: ReportePendiente;
  readonly resultado: Resultado;
}

export interface NuevoReporte {
  readonly codigoCategoria: string;
  readonly latitud: number;
  readonly longitud: number;
}

let contador = 0;

export async function encolar(reporte: NuevoReporte): Promise<ReportePendiente> {
  const ahora = Date.now();
  contador = (contador + 1) % 1000;
  const pendiente: ReportePendiente = {
    ...reporte,
    clave: crypto.randomUUID(),
    creadoEn: new Date(ahora).toISOString(),
    orden: ahora * 1000 + contador,
    intentos: 0,
  };
  await (await abrirAlmacen()).put('cola', pendiente);
  return pendiente;
}

export async function pendientes(): Promise<ReportePendiente[]> {
  return (await abrirAlmacen()).getAllFromIndex('cola', 'orden');
}

async function enviarUno(
  urlApi: string,
  pendiente: ReportePendiente,
  pedir: typeof fetch,
): Promise<Resultado> {
  const respuesta = await pedirConToken(urlApi, pedir, '/v1/reportes', {
    method: 'POST',
    headers: { ...JSON_CABECERA, 'idempotency-key': pendiente.clave },
    body: JSON.stringify({
      codigoCategoria: pendiente.codigoCategoria,
      latitud: pendiente.latitud,
      longitud: pendiente.longitud,
    }),
  });

  if (respuesta.ok) {
    const cuerpo = (await respuesta.json()) as {
      resultado: 'CREADO' | 'DUPLICADO' | 'PROPIO_EXISTENTE';
      reporte: { id: string };
    };
    // Se recuerda para no ofrecer votar: el autor no puede, y un duplicado ya contó como confirmación.
    await recordar(
      cuerpo.reporte.id,
      cuerpo.resultado === 'DUPLICADO' ? { voto: 'CONFIRMACION' } : { propio: true },
    );
    return { tipo: cuerpo.resultado, idReporte: cuerpo.reporte.id };
  }
  // 4xx: la API respondió y no lo aceptará aunque se reintente; se informa y se descarta.
  if (esRechazo(respuesta)) return rechazoDe(respuesta);
  return { tipo: 'PENDIENTE' };
}

let envioEnCurso: Promise<ResultadoDeEnvio[]> | null = null;

/**
 * Envía todos los pendientes en orden. Un 5xx o la falta de red los deja en la cola para el
 * próximo intento; cualquier otra respuesta los saca de ella. Dos llamadas simultáneas comparten
 * el mismo envío.
 */
export function enviarPendientes(
  urlApi: string,
  pedir: typeof fetch = fetch,
): Promise<ResultadoDeEnvio[]> {
  envioEnCurso ??= (async () => {
    const db = await abrirAlmacen();
    const resultados: ResultadoDeEnvio[] = [];
    for (const pendiente of await pendientes()) {
      let resultado: Resultado;
      try {
        resultado = await enviarUno(urlApi, pendiente, pedir);
      } catch {
        resultado = { tipo: 'PENDIENTE' };
      }
      if (resultado.tipo === 'PENDIENTE') {
        await db.put('cola', { ...pendiente, intentos: pendiente.intentos + 1 });
        resultados.push({ pendiente, resultado });
        // Sin red no tiene sentido probar los siguientes ahora.
        break;
      }
      await db.delete('cola', pendiente.clave);
      resultados.push({ pendiente, resultado });
    }
    return resultados;
  })().finally(() => {
    envioEnCurso = null;
  });
  return envioEnCurso;
}

/** Etiqueta de Background Sync con la que el service worker envía la cola. */
export const ETIQUETA_DE_SINCRONIZACION = 'enviar-reportes';
