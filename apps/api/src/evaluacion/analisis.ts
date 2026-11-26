// Análisis del piloto (ADR-007): los cuatro indicadores de beneficio (H1a a H1d) y los cuatro de
// costo, desde la exportación. Las pruebas inferenciales las hace `tools/piloto/contraste.R` con
// los CSV que deja este análisis. Definiciones operativas provisionales hasta que el protocolo las
// fije con el perfil v5 (Fase 13, Preparación 4).
import type { DatosDeEvaluacion, EnvioDato, TareaDato, Vista } from './datos.js';
import { construirReferencia, vidaDelReporte, vigenteYReal } from './referencia.js';
import type { Referencia, VidaDelReporte } from './referencia.js';

/** La vista base muestra cada envío durante 24 h. */
export const VENTANA_BASE_MS = 24 * 60 * 60 * 1000;

const MINUTO = 60_000;
const minutos = (ms: number) => Math.round((ms / MINUTO) * 10) / 10;

export interface FilaDeTarea {
  readonly participante: string;
  readonly secuencia: number;
  readonly orden: number;
  readonly vista: Vista;
  readonly escenario: string;
  readonly duracion_ms: number;
  readonly agotada: boolean;
  readonly aciertos: number;
  readonly omisiones: number;
  readonly de_mas: number;
  /** Marcas sobre incidentes sin verificar: no suman ni restan. */
  readonly neutras: number;
}

export interface FilaDeVeracidad {
  readonly id_reporte: string;
  readonly categoria: string;
  readonly confirmado: boolean;
  readonly real: boolean;
}

export interface FilaDeVigencia {
  readonly id_reporte: string;
  readonly categoria: string;
  /** Minutos que siguió visible después de terminar, en cada vista. */
  readonly exceso_procesada_min: number;
  readonly exceso_base_min: number;
  /** Salió del mapa procesado antes de terminar. */
  readonly prematuro: boolean;
}

export interface FilaDeSupervivencia {
  readonly id_reporte: string;
  readonly categoria: string;
  /** Desde la creación hasta el fin verificado (evento) o hasta que dejó de verse (censura). */
  readonly minutos: number;
  readonly evento: 0 | 1;
  readonly ttl_minutos: number | null;
}

export interface FilaDeCosto {
  readonly hipotesis: string;
  readonly indicador: string;
  readonly casos: number;
  readonly total: number;
}

export interface Indicador {
  readonly hipotesis: string;
  readonly indicador: string;
  readonly tipo: 'beneficio' | 'costo';
  readonly vista: Vista | 'AMBAS';
  readonly unidad: string;
  readonly valor: number | null;
  readonly n: number;
}

export interface ResultadoDelRegistro {
  readonly veracidad: readonly FilaDeVeracidad[];
  readonly vigencia: readonly FilaDeVigencia[];
  readonly supervivencia: readonly FilaDeSupervivencia[];
  readonly costos: readonly FilaDeCosto[];
  readonly indicadores: readonly Indicador[];
}

export interface ResultadoDelAnalisis extends ResultadoDelRegistro {
  readonly tareas: readonly FilaDeTarea[];
}

/** Mediana con interpolación (la de R por defecto); `null` sin datos. */
export function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const o = valores.toSorted((a, b) => a - b);
  const medio = (o.length - 1) / 2;
  return (o[Math.floor(medio)]! + o[Math.ceil(medio)]!) / 2;
}

const proporcion = (casos: number, total: number): number | null =>
  total === 0 ? null : Math.round((casos / total) * 1000) / 1000;

// --- Tareas (H1a y H1b) ---

/** El grupo (incidente) de un punto: el envío en la base; el envío que creó el reporte en la procesada. */
const grupoDelPunto = (referencia: Referencia, idPunto: string) => referencia.grupoDe(idPunto);

interface Escena {
  readonly instante: number;
  readonly puntos: Readonly<Record<Vista, readonly string[]>>;
  /** Incidentes reales y vigentes en el instante que aparecen en alguna de las dos vistas. */
  readonly clave: ReadonlySet<string>;
}

function escenas(datos: DatosDeEvaluacion, referencia: Referencia): Map<string, Escena> {
  const resultado = new Map<string, Escena>();
  for (const instantanea of datos.instantaneas) {
    const deEsta = datos.puntos.filter((p) => p.idInstantanea === instantanea.id);
    const puntos = {
      PROCESADA: deEsta.filter((p) => p.vista === 'PROCESADA').map((p) => p.idPunto),
      BASE: deEsta.filter((p) => p.vista === 'BASE').map((p) => p.idPunto),
    };
    const grupos = deEsta
      .map((p) => grupoDelPunto(referencia, p.idPunto))
      .filter((g): g is string => g !== undefined);
    const clave = new Set(
      grupos.filter((g) => vigenteYReal(referencia.incidente(g), instantanea.instante)),
    );
    resultado.set(instantanea.id, { instante: instantanea.instante, puntos, clave });
  }
  return resultado;
}

interface Conteo {
  aciertos: number;
  de_mas: number;
  neutras: number;
}

/**
 * Aciertos: incidentes de la clave marcados al menos una vez. De más: marcas sobre algo que no es
 * de la clave (falso o ya terminado) o la segunda marca de un mismo incidente. Neutras: marcas sobre
 * un incidente sin verificar o un envío sin etiquetar.
 */
function contarMarcas(
  idsDePuntos: readonly string[],
  escena: Escena,
  referencia: Referencia,
): Conteo {
  const conteo: Conteo = { aciertos: 0, de_mas: 0, neutras: 0 };
  const acertados = new Set<string>();
  for (const idPunto of idsDePuntos) {
    const grupo = grupoDelPunto(referencia, idPunto) ?? '';
    const incidente = referencia.incidente(grupo);
    if (incidente === undefined || incidente.real === null) {
      conteo.neutras += 1;
    } else if (escena.clave.has(grupo) && !acertados.has(grupo)) {
      acertados.add(grupo);
      conteo.aciertos += 1;
    } else conteo.de_mas += 1;
  }
  return conteo;
}

function filaDeTarea(
  tarea: TareaDato,
  datos: DatosDeEvaluacion,
  escena: Escena,
  referencia: Referencia,
): FilaDeTarea {
  const marcados = datos.marcas.filter((m) => m.idTarea === tarea.idTarea).map((m) => m.idPunto);
  const conteo = contarMarcas(marcados, escena, referencia);
  return {
    participante: tarea.codigoParticipante,
    secuencia: tarea.secuencia,
    orden: tarea.orden,
    vista: tarea.vista,
    escenario: tarea.escenario,
    duracion_ms: tarea.duracionMs ?? 0,
    agotada: tarea.agotada ?? false,
    ...conteo,
    omisiones: escena.clave.size - conteo.aciertos,
  };
}

function analizarTareas(datos: DatosDeEvaluacion, referencia: Referencia) {
  const porInstantanea = escenas(datos, referencia);
  const filas = datos.tareas
    .filter((t) => t.duracionMs !== null && porInstantanea.has(t.idInstantanea))
    .map((t) => filaDeTarea(t, datos, porInstantanea.get(t.idInstantanea)!, referencia));
  const redundancia = (vista: Vista) =>
    [...porInstantanea.values()]
      .filter((e) => e.clave.size > 0)
      .map((e) => {
        const enClave = e.puntos[vista].filter((p) =>
          e.clave.has(grupoDelPunto(referencia, p) ?? ''),
        );
        const incidentes = new Set(enClave.map((p) => grupoDelPunto(referencia, p)));
        return incidentes.size === 0 ? null : enClave.length / incidentes.size;
      })
      .filter((r): r is number => r !== null);
  return { filas, redundancia };
}

function indicadoresDeTareas(
  filas: readonly FilaDeTarea[],
  redundancia: (vista: Vista) => number[],
): Indicador[] {
  return (['PROCESADA', 'BASE'] as const).flatMap((vista) => {
    const deLaVista = filas.filter((f) => f.vista === vista);
    const med = (f: (x: FilaDeTarea) => number) => mediana(deLaVista.map(f));
    const n = deLaVista.length;
    const puntosPorIncidente = redundancia(vista);
    return [
      {
        hipotesis: 'H1a',
        indicador: 'tiempo de la tarea',
        tipo: 'beneficio',
        vista,
        unidad: 's (mediana)',
        valor: med((f) => f.duracion_ms / 1000),
        n,
      },
      {
        hipotesis: 'H1a',
        indicador: 'aciertos',
        tipo: 'beneficio',
        vista,
        unidad: 'incidentes (mediana)',
        valor: med((f) => f.aciertos),
        n,
      },
      {
        hipotesis: 'H1a',
        indicador: 'omisiones',
        tipo: 'costo',
        vista,
        unidad: 'incidentes (mediana)',
        valor: med((f) => f.omisiones),
        n,
      },
      {
        hipotesis: 'H1b',
        indicador: 'marcados de más',
        tipo: 'beneficio',
        vista,
        unidad: 'marcas (mediana)',
        valor: med((f) => f.de_mas),
        n,
      },
      {
        hipotesis: 'H1b',
        indicador: 'puntos por incidente real',
        tipo: 'beneficio',
        vista,
        unidad: 'puntos (mediana por instantánea)',
        valor: mediana(puntosPorIncidente),
        n: puntosPorIncidente.length,
      },
    ] satisfies Indicador[];
  });
}

// --- Registro (H1b fusiones, H1c, H1d) ---

function enviosPorReporte(envios: readonly EnvioDato[]): Map<string, EnvioDato[]> {
  const mapa = new Map<string, EnvioDato[]>();
  for (const e of envios) mapa.set(e.idReporte, [...(mapa.get(e.idReporte) ?? []), e]);
  return mapa;
}

/** Reportes con dos o más envíos etiquetados que juntaron más de un incidente real. */
function fusionesErroneas(
  porReporte: Map<string, EnvioDato[]>,
  referencia: Referencia,
): FilaDeCosto {
  let casos = 0;
  let total = 0;
  for (const envios of porReporte.values()) {
    const grupos = envios.map((e) => referencia.grupoDe(e.idEnvio));
    if (envios.length < 2 || grupos.some((g) => g === undefined)) continue;
    total += 1;
    if (new Set(grupos).size > 1) casos += 1;
  }
  return { hipotesis: 'H1b', indicador: 'fusiones erróneas', casos, total };
}

interface ReporteVerificado {
  readonly id: string;
  readonly categoria: string;
  readonly vida: VidaDelReporte;
  readonly ultimoEnvio: number;
  readonly real: boolean;
  readonly finEn: number | null;
}

function reportesVerificados(
  datos: DatosDeEvaluacion,
  referencia: Referencia,
): ReporteVerificado[] {
  const porReporte = enviosPorReporte(datos.envios);
  const resultado: ReporteVerificado[] = [];
  for (const [id, envios] of porReporte) {
    const creado = envios.find((e) => e.tipo === 'CREADO');
    const verificacion = referencia.verificacion(id);
    const vida = vidaDelReporte(datos.transiciones.filter((t) => t.idReporte === id));
    if (!creado || creado.fuenteOficial !== null || !vida || !verificacion) continue;
    if (verificacion.resultado === 'NO_VERIFICABLE') continue;
    resultado.push({
      id,
      categoria: creado.codigoCategoria,
      vida,
      ultimoEnvio: Math.max(...envios.map((e) => e.recibidoEn)),
      real: verificacion.resultado === 'REAL',
      finEn: verificacion.finEn,
    });
  }
  return resultado;
}

function filasDeVigencia(reportes: readonly ReporteVerificado[]): FilaDeVigencia[] {
  return reportes
    .filter((r): r is ReporteVerificado & { finEn: number } => r.real && r.finEn !== null)
    .map((r) => ({
      id_reporte: r.id,
      categoria: r.categoria,
      exceso_procesada_min: minutos(Math.max(0, r.vida.finVisible - r.finEn)),
      exceso_base_min: minutos(Math.max(0, r.ultimoEnvio + VENTANA_BASE_MS - r.finEn)),
      prematuro: r.vida.finVisible < r.finEn,
    }));
}

function filasDeSupervivencia(
  reportes: readonly ReporteVerificado[],
  ttlPorCategoria: ReadonlyMap<string, number>,
): FilaDeSupervivencia[] {
  return reportes
    .filter((r) => r.real)
    .map((r) => ({
      id_reporte: r.id,
      categoria: r.categoria,
      minutos: minutos((r.finEn ?? r.vida.finVisible) - r.vida.creadoEn),
      evento: r.finEn === null ? 0 : 1,
      ttl_minutos: ttlPorCategoria.get(r.categoria) ?? null,
    }));
}

function indicadoresDelRegistro(
  veracidad: readonly FilaDeVeracidad[],
  vigencia: readonly FilaDeVigencia[],
  reportes: readonly ReporteVerificado[],
  costos: readonly FilaDeCosto[],
): Indicador[] {
  const confirmados = veracidad.filter((v) => v.confirmado);
  const latencias = reportes
    .filter((r) => r.real && r.vida.confirmadoEn !== null)
    .map((r) => minutos(r.vida.confirmadoEn! - r.vida.creadoEn));
  const costo = (indicador: string): Indicador => {
    const c = costos.find((x) => x.indicador === indicador)!;
    return {
      hipotesis: c.hipotesis,
      indicador,
      tipo: 'costo',
      vista: 'PROCESADA',
      unidad: 'proporción',
      valor: proporcion(c.casos, c.total),
      n: c.total,
    };
  };
  return [
    costo('fusiones erróneas'),
    {
      hipotesis: 'H1c',
      indicador: 'reales entre lo mostrado',
      tipo: 'beneficio',
      vista: 'PROCESADA',
      unidad: 'proporción (confirmados)',
      valor: proporcion(confirmados.filter((v) => v.real).length, confirmados.length),
      n: confirmados.length,
    },
    {
      hipotesis: 'H1c',
      indicador: 'reales entre lo mostrado',
      tipo: 'beneficio',
      vista: 'BASE',
      unidad: 'proporción (todos los envíos)',
      valor: proporcion(veracidad.filter((v) => v.real).length, veracidad.length),
      n: veracidad.length,
    },
    costo('reales sin confirmar'),
    {
      hipotesis: 'H1c',
      indicador: 'latencia de confirmación',
      tipo: 'costo',
      vista: 'PROCESADA',
      unidad: 'min (mediana)',
      valor: mediana(latencias),
      n: latencias.length,
    },
    {
      hipotesis: 'H1d',
      indicador: 'visible después del fin',
      tipo: 'beneficio',
      vista: 'PROCESADA',
      unidad: 'min (mediana)',
      valor: mediana(vigencia.map((v) => v.exceso_procesada_min)),
      n: vigencia.length,
    },
    {
      hipotesis: 'H1d',
      indicador: 'visible después del fin',
      tipo: 'beneficio',
      vista: 'BASE',
      unidad: 'min (mediana)',
      valor: mediana(vigencia.map((v) => v.exceso_base_min)),
      n: vigencia.length,
    },
    costo('caducidad prematura'),
  ];
}

/**
 * Lo que sale solo del registro, la etiqueta y la verificación, sin las tareas: es lo que el
 * análisis de sensibilidad recalcula con otros parámetros.
 */
export function analizarRegistro(
  datos: DatosDeEvaluacion,
  ttlPorCategoria: ReadonlyMap<string, number>,
): ResultadoDelRegistro {
  const referencia = construirReferencia(datos);
  const reportes = reportesVerificados(datos, referencia);
  const veracidad = reportes.map((r) => ({
    id_reporte: r.id,
    categoria: r.categoria,
    confirmado: r.vida.confirmadoEn !== null,
    real: r.real,
  }));
  const vigencia = filasDeVigencia(reportes);
  const reales = veracidad.filter((v) => v.real);
  const costos: FilaDeCosto[] = [
    fusionesErroneas(enviosPorReporte(datos.envios), referencia),
    {
      hipotesis: 'H1c',
      indicador: 'reales sin confirmar',
      casos: reales.filter((v) => !v.confirmado).length,
      total: reales.length,
    },
    {
      hipotesis: 'H1d',
      indicador: 'caducidad prematura',
      casos: vigencia.filter((v) => v.prematuro).length,
      total: vigencia.length,
    },
  ];
  return {
    veracidad,
    vigencia,
    supervivencia: filasDeSupervivencia(reportes, ttlPorCategoria),
    costos,
    indicadores: indicadoresDelRegistro(veracidad, vigencia, reportes, costos),
  };
}

/** El análisis completo: el registro y las tareas cronometradas. */
export function analizar(
  datos: DatosDeEvaluacion,
  ttlPorCategoria: ReadonlyMap<string, number>,
): ResultadoDelAnalisis {
  const referencia = construirReferencia(datos);
  const { filas, redundancia } = analizarTareas(datos, referencia);
  const registro = analizarRegistro(datos, ttlPorCategoria);
  return {
    ...registro,
    tareas: filas,
    indicadores: [...indicadoresDeTareas(filas, redundancia), ...registro.indicadores],
  };
}
