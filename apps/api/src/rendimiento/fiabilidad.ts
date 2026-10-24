// Evaluación de la prueba de reinicio (Fase 11, prueba 3.2): con lo que vio el cliente y lo que
// quedó en la base, decide si se perdió o se duplicó algún reporte o evento.

/** Lo que el cliente sabe de un envío al terminar, tras reintentar con la misma clave. */
export interface Envio {
  readonly clave: string;
  /** `null` si ni el reintento obtuvo respuesta. */
  readonly resultado: 'CREADO' | 'DUPLICADO' | 'PROPIO_EXISTENTE' | null;
  readonly idReporte: string | null;
  /** El primer intento quedó sin respuesta porque la API murió. */
  readonly reintentado: boolean;
  /** Tras el reinicio, el reenvío con la misma clave devolvió el mismo reporte. */
  readonly reenvioCoincide: boolean;
}

/** Lo que quedó en la base para un reporte creado. */
export interface EstadoEnBase {
  /** Filas de `reportes` con esa clave de idempotencia. */
  readonly filas: number;
  /** Eventos `ReporteCreado` (de cualquier versión) del reporte en el outbox. */
  readonly eventos: number;
  /** De esos eventos, cuántos quedaron publicados. */
  readonly publicados: number;
}

export interface ResumenDeReinicio {
  readonly envios: number;
  readonly reintentados: number;
  /** Reintentados cuyo primer intento sí se había guardado: la idempotencia evitó el duplicado. */
  readonly guardadosSinRespuesta: number;
  readonly creados: number;
  readonly reportesPerdidos: number;
  readonly reportesDuplicados: number;
  readonly eventosPerdidos: number;
  readonly eventosDuplicados: number;
  /** Reenvíos que no devolvieron el mismo reporte: la idempotencia no sobrevivió al reinicio. */
  readonly reenviosInconsistentes: number;
  readonly cumple: boolean;
}

export function evaluarReinicio(
  envios: readonly Envio[],
  enBase: ReadonlyMap<string, EstadoEnBase>,
  clavesGuardadasAntesDelReintento: ReadonlySet<string>,
): ResumenDeReinicio {
  const sinRegistro: EstadoEnBase = { filas: 0, eventos: 0, publicados: 0 };
  const creados = envios.filter((envio) => envio.resultado === 'CREADO');
  const estados = creados.map((envio) => enBase.get(envio.clave) ?? sinRegistro);

  const sinRespuesta = envios.filter((envio) => envio.resultado === null).length;
  const reportesPerdidos = sinRespuesta + estados.filter((e) => e.filas === 0).length;
  const reportesDuplicados = [...enBase.values()].filter((e) => e.filas > 1).length;
  const eventosPerdidos = estados.filter((e) => e.publicados === 0).length;
  const eventosDuplicados = estados.filter((e) => e.eventos > 1).length;
  const reenviosInconsistentes = envios.filter((envio) => !envio.reenvioCoincide).length;
  const fallos = [reportesPerdidos, reportesDuplicados, eventosPerdidos, eventosDuplicados];

  return {
    envios: envios.length,
    reintentados: envios.filter((envio) => envio.reintentado).length,
    guardadosSinRespuesta: envios.filter(
      (envio) => envio.reintentado && clavesGuardadasAntesDelReintento.has(envio.clave),
    ).length,
    creados: creados.length,
    reportesPerdidos,
    reportesDuplicados,
    eventosPerdidos,
    eventosDuplicados,
    reenviosInconsistentes,
    cumple: [...fallos, reenviosInconsistentes].every((cantidad) => cantidad === 0),
  };
}
