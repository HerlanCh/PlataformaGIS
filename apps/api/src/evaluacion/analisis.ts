// Análisis del piloto (ADR-007, perfil v5): los indicadores de beneficio de H1a a H1d y sus costos,
// desde la exportación. Las unidades y medidas siguen las Tablas 3 y 6 del perfil
// (`docs/perfil-v5.md`). Las pruebas inferenciales las hace `tools/piloto/contraste.R` con los CSV
// que deja este análisis.
import type { DatosDeEvaluacion, EnvioDato, TareaDato, Vista } from './datos.js';
import { construirReferencia, vidaDelReporte, vigenteYReal } from './referencia.js';
import type { Referencia, VidaDelReporte } from './referencia.js';

/** La vista base muestra cada envío durante 24 h. */
export const VENTANA_BASE_MS = 24 * 60 * 60 * 1000;

const MINUTO = 60_000;
const minutos = (ms: number) => Math.round((ms / MINUTO) * 10) / 10;
const redondear = (valor: number) => Math.round(valor * 1000) / 1000;

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
  /** Marcas sobre incidentes sin verificar o envíos sin etiquetar: no suman ni restan. */
  readonly neutras: number;
  /** Aciertos y omisiones sobre los incidentes de la clave; nulas si la clave está vacía. */
  readonly tasa_acierto: number | null;
  readonly tasa_omision: number | null;
}

/** H1b: un incidente único (grupo del etiquetado) y cuántos ítems ocupa en cada vista. */
export interface FilaDeIncidente {
  readonly grupo: string;
  readonly categoria: string;
  readonly items_base: number;
  readonly items_procesada: number;
}

export interface FilaDeVeracidad {
  readonly id_reporte: string;
  readonly categoria: string;
  readonly confirmado: boolean;
  readonly real: boolean;
}

/** H1d: un incidente real con hora de fin verificada. */
export interface FilaDeVigencia {
  readonly grupo: string;
  readonly categoria: string;
  /** Minutos que siguió visible como activo después de terminar, en cada vista. */
  readonly exceso_procesada_min: number;
  readonly exceso_base_min: number;
  /** Salió de la vista procesada cuando aún estaba activo. */
  readonly prematuro: boolean;
  /** Minutos de anticipo de esa salida; nulo si no fue prematura. */
  readonly anticipo_min: number | null;
}

export interface FilaDeSupervivencia {
  readonly grupo: string;
  readonly categoria: string;
  /** Desde el primer envío hasta el fin verificado (evento) o hasta que dejó de verse (censura). */
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
  readonly incidentes: readonly FilaDeIncidente[];
  readonly veracidad: readonly FilaDeVeracidad[];
  readonly vigencia: readonly FilaDeVigencia[];
  readonly supervivencia: readonly FilaDeSupervivencia[];
  readonly costos: readonly FilaDeCosto[];
  readonly indicadores: readonly Indicador[];
}

export interface ResultadoDelAnalisis extends ResultadoDelRegistro {
  readonly tareas: readonly FilaDeTarea[];
  /** Lo que el informe debe advertir, como una clave calculada porque no se fijó. */
  readonly avisos: readonly string[];
}

/** Mediana con interpolación (la de R por defecto); `null` sin datos. */
export function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const o = valores.toSorted((a, b) => a - b);
  const medio = (o.length - 1) / 2;
  return (o[Math.floor(medio)]! + o[Math.ceil(medio)]!) / 2;
}

const proporcion = (casos: number, total: number): number | null =>
  total === 0 ? null : redondear(casos / total);

// --- Tareas (H1a) ---

interface Escena {
  readonly nombre: string;
  readonly puntos: Readonly<Record<Vista, readonly string[]>>;
  /** Los incidentes activos: la clave que fijaron los evaluadores, o la calculada si falta. */
  readonly clave: ReadonlySet<string>;
  readonly calculada: boolean;
}

/**
 * La clave de una instantánea la fijan los evaluadores antes de las sesiones (perfil v5, 6.3).
 * Si falta, se calcula con los incidentes reales y vigentes en el instante que aparecen en alguna
 * vista, y el resumen lo advierte.
 */
function escenas(datos: DatosDeEvaluacion, referencia: Referencia): Map<string, Escena> {
  const resultado = new Map<string, Escena>();
  for (const instantanea of datos.instantaneas) {
    const deEsta = datos.puntos.filter((p) => p.idInstantanea === instantanea.id);
    const fijada = datos.claves
      .filter((c) => c.idInstantanea === instantanea.id)
      .map((c) => c.grupo);
    const calculada = deEsta
      .map((p) => referencia.grupoDe(p.idPunto))
      .filter(
        (g): g is string =>
          g !== undefined && vigenteYReal(referencia.incidente(g), instantanea.instante),
      );
    resultado.set(instantanea.id, {
      nombre: instantanea.nombre,
      puntos: {
        PROCESADA: deEsta.filter((p) => p.vista === 'PROCESADA').map((p) => p.idPunto),
        BASE: deEsta.filter((p) => p.vista === 'BASE').map((p) => p.idPunto),
      },
      clave: new Set(fijada.length > 0 ? fijada : calculada),
      calculada: fijada.length === 0,
    });
  }
  return resultado;
}

interface Conteo {
  aciertos: number;
  de_mas: number;
  neutras: number;
}

/**
 * Aciertos: incidentes de la clave marcados al menos una vez. De más: una marca sobre algo que no
 * está en la clave (falso o terminado) o la segunda marca de un mismo incidente. Neutras: una marca
 * sobre un envío sin etiquetar o un incidente que no está en la clave ni se pudo verificar.
 */
function contarMarcas(
  idsDePuntos: readonly string[],
  escena: Escena,
  referencia: Referencia,
): Conteo {
  const conteo: Conteo = { aciertos: 0, de_mas: 0, neutras: 0 };
  const acertados = new Set<string>();
  for (const idPunto of idsDePuntos) {
    const grupo = referencia.grupoDe(idPunto) ?? '';
    const enClave = escena.clave.has(grupo);
    const real = referencia.incidente(grupo)?.real;
    const conocido = enClave || real === true || real === false;
    if (!conocido) conteo.neutras += 1;
    else if (enClave && !acertados.has(grupo)) {
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
  const omisiones = escena.clave.size - conteo.aciertos;
  return {
    participante: tarea.codigoParticipante,
    secuencia: tarea.secuencia,
    orden: tarea.orden,
    vista: tarea.vista,
    escenario: tarea.escenario,
    duracion_ms: tarea.duracionMs ?? 0,
    agotada: tarea.agotada ?? false,
    ...conteo,
    omisiones,
    tasa_acierto: proporcion(conteo.aciertos, escena.clave.size),
    tasa_omision: proporcion(omisiones, escena.clave.size),
  };
}

function analizarTareas(datos: DatosDeEvaluacion, referencia: Referencia) {
  const porInstantanea = escenas(datos, referencia);
  const filas = datos.tareas
    .filter((t) => t.duracionMs !== null && porInstantanea.has(t.idInstantanea))
    .map((t) => filaDeTarea(t, datos, porInstantanea.get(t.idInstantanea)!, referencia));
  const avisos = [...porInstantanea.values()]
    .filter(
      (e) => e.calculada && datos.tareas.some((t) => porInstantanea.get(t.idInstantanea) === e),
    )
    .map(
      (e) =>
        `La clave de ${e.nombre} se calculó con el etiquetado y la verificación: los evaluadores no la fijaron.`,
    );
  return { filas, avisos };
}

function indicadoresDeTareas(filas: readonly FilaDeTarea[]): Indicador[] {
  return (['PROCESADA', 'BASE'] as const).flatMap((vista) => {
    const deLaVista = filas.filter((f) => f.vista === vista);
    const med = (f: (x: FilaDeTarea) => number | null) =>
      mediana(deLaVista.map(f).filter((v): v is number => v !== null));
    const n = deLaVista.length;
    return [
      {
        hipotesis: 'H1a',
        indicador: 'segundos para identificar los incidentes activos',
        tipo: 'beneficio',
        vista,
        unidad: 's (mediana)',
        valor: med((f) => f.duracion_ms / 1000),
        n,
      },
      {
        hipotesis: 'H1a',
        indicador: 'tasa de acierto',
        tipo: 'costo',
        vista,
        unidad: 'proporción (mediana)',
        valor: med((f) => f.tasa_acierto),
        n,
      },
      {
        hipotesis: 'H1a',
        indicador: 'incidentes activos omitidos',
        tipo: 'costo',
        vista,
        unidad: 'proporción (mediana)',
        valor: med((f) => f.tasa_omision),
        n,
      },
      {
        hipotesis: 'H1a',
        indicador: 'marcados de más',
        tipo: 'costo',
        vista,
        unidad: 'marcas (mediana)',
        valor: med((f) => f.de_mas),
        n,
      },
    ] satisfies Indicador[];
  });
}

// --- Registro (H1b, H1c y H1d) ---

interface Incidente {
  readonly grupo: string;
  readonly categoria: string;
  readonly envios: readonly EnvioDato[];
}

/** Los reportes rechazados por moderación: sus envíos no entran en ninguna vista. */
const rechazados = (datos: DatosDeEvaluacion) =>
  new Set(datos.transiciones.filter((t) => t.estado === 'RECHAZADO').map((t) => t.idReporte));

/** Incidentes únicos: los grupos del etiquetado con sus envíos no rechazados. */
function incidentesUnicos(datos: DatosDeEvaluacion, referencia: Referencia): Incidente[] {
  const fuera = rechazados(datos);
  const porGrupo = new Map<string, EnvioDato[]>();
  for (const envio of datos.envios) {
    const grupo = referencia.grupoDe(envio.idEnvio);
    if (grupo === undefined || fuera.has(envio.idReporte)) continue;
    porGrupo.set(grupo, [...(porGrupo.get(grupo) ?? []), envio]);
  }
  return [...porGrupo].map(([grupo, envios]) => ({
    grupo,
    categoria: envios[0]!.codigoCategoria,
    envios,
  }));
}

/**
 * H1b (perfil v5, Tabla 3): ítems por incidente único. En la base, cada envío es un ítem; en la
 * procesada, cada alerta (reporte) que contiene alguno de sus envíos.
 */
const filasDeIncidentes = (incidentes: readonly Incidente[]): FilaDeIncidente[] =>
  incidentes.map((i) => ({
    grupo: i.grupo,
    categoria: i.categoria,
    items_base: i.envios.length,
    items_procesada: new Set(i.envios.map((e) => e.idReporte)).size,
  }));

/** Alertas que juntaron envíos de incidentes distintos, entre las que tienen dos o más envíos etiquetados. */
function fusionesErroneas(datos: DatosDeEvaluacion, referencia: Referencia): FilaDeCosto {
  const porReporte = new Map<string, (string | undefined)[]>();
  for (const e of datos.envios)
    porReporte.set(e.idReporte, [
      ...(porReporte.get(e.idReporte) ?? []),
      referencia.grupoDe(e.idEnvio),
    ]);
  const evaluables = [...porReporte.values()].filter(
    (g) => g.length >= 2 && !g.includes(undefined),
  );
  return {
    hipotesis: 'H1b',
    indicador: 'fusiones erróneas',
    casos: evaluables.filter((g) => new Set(g).size > 1).length,
    total: evaluables.length,
  };
}

/** La vida de cada reporte, desde sus transiciones. */
function vidas(datos: DatosDeEvaluacion): Map<string, VidaDelReporte> {
  const porReporte = new Map<string, DatosDeEvaluacion['transiciones'][number][]>();
  for (const t of datos.transiciones)
    porReporte.set(t.idReporte, [...(porReporte.get(t.idReporte) ?? []), t]);
  const resultado = new Map<string, VidaDelReporte>();
  for (const [id, transiciones] of porReporte) {
    const vida = vidaDelReporte(transiciones);
    if (vida) resultado.set(id, vida);
  }
  return resultado;
}

interface ReporteDeLaComunidad {
  readonly id: string;
  readonly categoria: string;
  readonly confirmado: boolean;
  readonly vida: VidaDelReporte;
}

/** Los reportes de la comunidad creados y no rechazados: la población de la que sale la muestra de H1c. */
function reportesDeLaComunidad(
  datos: DatosDeEvaluacion,
  vidaDe: Map<string, VidaDelReporte>,
): ReporteDeLaComunidad[] {
  const fuera = rechazados(datos);
  return datos.envios
    .filter(
      (e) =>
        e.tipo === 'CREADO' &&
        e.fuenteOficial === null &&
        !fuera.has(e.idReporte) &&
        vidaDe.has(e.idReporte),
    )
    .map((e) => {
      const vida = vidaDe.get(e.idReporte)!;
      return {
        id: e.idReporte,
        categoria: e.codigoCategoria,
        confirmado: vida.confirmadoEn !== null,
        vida,
      };
    });
}

/**
 * H1c (perfil v5, 6.5): la veracidad de la vista base se estima ponderando cada estrato (categoría
 * y si se confirmó, como se sortea la muestra) por su tamaño en el total de reportes. Los estratos
 * sin reportes verificados no aportan.
 */
export function veracidadPonderada(
  poblacion: readonly Pick<ReporteDeLaComunidad, 'categoria' | 'confirmado'>[],
  muestra: readonly FilaDeVeracidad[],
): number | null {
  const estrato = (r: { categoria: string; confirmado: boolean }) =>
    `${r.categoria}|${r.confirmado}`;
  let suma = 0;
  let peso = 0;
  for (const nombre of new Set(muestra.map(estrato))) {
    const tamano = poblacion.filter((r) => estrato(r) === nombre).length;
    const verificados = muestra.filter((v) => estrato(v) === nombre);
    suma += tamano * (verificados.filter((v) => v.real).length / verificados.length);
    peso += tamano;
  }
  return peso === 0 ? null : redondear(suma / peso);
}

function analizarVeracidad(referencia: Referencia, poblacion: readonly ReporteDeLaComunidad[]) {
  const comprobados = poblacion.filter((r) => referencia.verificacion(r.id));
  const veracidad: FilaDeVeracidad[] = comprobados
    .filter((r) => referencia.verificacion(r.id)!.resultado !== 'NO_VERIFICABLE')
    .map((r) => ({
      id_reporte: r.id,
      categoria: r.categoria,
      confirmado: r.confirmado,
      real: referencia.verificacion(r.id)!.resultado === 'REAL',
    }));
  const reales = veracidad.filter((v) => v.real);
  const latencias = poblacion
    .filter((r) => r.vida.confirmadoEn !== null && reales.some((v) => v.id_reporte === r.id))
    .map((r) => minutos(r.vida.confirmadoEn! - r.vida.creadoEn));
  const costos: FilaDeCosto[] = [
    {
      hipotesis: 'H1c',
      indicador: 'reales sin confirmar',
      casos: reales.filter((v) => !v.confirmado).length,
      total: reales.length,
    },
    {
      hipotesis: 'H1c',
      indicador: 'no verificables',
      casos: comprobados.length - veracidad.length,
      total: comprobados.length,
    },
  ];
  return { veracidad, latencias, costos };
}

/**
 * H1d (perfil v5, 6.5): por incidente real con hora de fin. En la base sigue visible hasta 24 h
 * después de su último envío; en la procesada, hasta que su última alerta caduca o se resuelve.
 */
function filasDeVigencia(
  incidentes: readonly Incidente[],
  referencia: Referencia,
  vidaDe: Map<string, VidaDelReporte>,
): FilaDeVigencia[] {
  const filas: FilaDeVigencia[] = [];
  for (const i of incidentes) {
    const { real, finEn } = referencia.incidente(i.grupo) ?? {};
    const alertas = [...new Set(i.envios.map((e) => e.idReporte))]
      .map((id) => vidaDe.get(id))
      .filter((v) => v !== undefined);
    if (real !== true || finEn === null || finEn === undefined || alertas.length === 0) continue;
    const finProcesada = Math.max(...alertas.map((v) => v.finVisible));
    const finBase = Math.max(...i.envios.map((e) => e.recibidoEn)) + VENTANA_BASE_MS;
    const prematuro = finProcesada < finEn;
    filas.push({
      grupo: i.grupo,
      categoria: i.categoria,
      exceso_procesada_min: minutos(Math.max(0, finProcesada - finEn)),
      exceso_base_min: minutos(Math.max(0, finBase - finEn)),
      prematuro,
      anticipo_min: prematuro ? minutos(finEn - finProcesada) : null,
    });
  }
  return filas;
}

/** Cuánto dura de verdad cada incidente real, frente al tiempo de vida de su categoría. */
function filasDeSupervivencia(
  incidentes: readonly Incidente[],
  referencia: Referencia,
  vidaDe: Map<string, VidaDelReporte>,
  ttlPorCategoria: ReadonlyMap<string, number>,
): FilaDeSupervivencia[] {
  const filas: FilaDeSupervivencia[] = [];
  for (const i of incidentes) {
    const incidente = referencia.incidente(i.grupo);
    const finesVisibles = i.envios
      .map((e) => vidaDe.get(e.idReporte)?.finVisible)
      .filter((f) => f !== undefined);
    if (incidente?.real !== true || (incidente.finEn === null && finesVisibles.length === 0))
      continue;
    const inicio = Math.min(...i.envios.map((e) => e.recibidoEn));
    filas.push({
      grupo: i.grupo,
      categoria: i.categoria,
      minutos: minutos((incidente.finEn ?? Math.max(...finesVisibles)) - inicio),
      evento: incidente.finEn === null ? 0 : 1,
      ttl_minutos: ttlPorCategoria.get(i.categoria) ?? null,
    });
  }
  return filas;
}

const costo = (
  costos: readonly FilaDeCosto[],
  indicador: string,
  unidad = 'proporción',
): Indicador => {
  const c = costos.find((x) => x.indicador === indicador)!;
  return {
    hipotesis: c.hipotesis,
    indicador,
    tipo: 'costo',
    vista: 'PROCESADA',
    unidad,
    valor: proporcion(c.casos, c.total),
    n: c.total,
  };
};

interface PartesDelRegistro {
  readonly incidentes: readonly FilaDeIncidente[];
  readonly veracidad: readonly FilaDeVeracidad[];
  readonly veracidadBase: number | null;
  readonly latencias: readonly number[];
  readonly vigencia: readonly FilaDeVigencia[];
  readonly costos: readonly FilaDeCosto[];
}

function indicadoresDelRegistro(p: PartesDelRegistro): Indicador[] {
  const confirmados = p.veracidad.filter((v) => v.confirmado);
  const reales = p.veracidad.filter((v) => v.real);
  const anticipos = p.vigencia.map((v) => v.anticipo_min).filter((a): a is number => a !== null);
  const n = p.incidentes.length;
  return [
    {
      hipotesis: 'H1b',
      indicador: 'ítems por incidente único',
      tipo: 'beneficio',
      vista: 'PROCESADA',
      unidad: 'ítems (mediana)',
      valor: mediana(p.incidentes.map((i) => i.items_procesada)),
      n,
    },
    {
      hipotesis: 'H1b',
      indicador: 'ítems por incidente único',
      tipo: 'beneficio',
      vista: 'BASE',
      unidad: 'ítems (mediana)',
      valor: mediana(p.incidentes.map((i) => i.items_base)),
      n,
    },
    costo(p.costos, 'fusiones erróneas'),
    {
      hipotesis: 'H1c',
      indicador: 'alertas que corresponden a incidentes reales',
      tipo: 'beneficio',
      vista: 'PROCESADA',
      unidad: 'proporción (confirmadas)',
      valor: proporcion(confirmados.filter((v) => v.real).length, confirmados.length),
      n: confirmados.length,
    },
    {
      hipotesis: 'H1c',
      indicador: 'alertas que corresponden a incidentes reales',
      tipo: 'beneficio',
      vista: 'BASE',
      unidad: 'proporción (todos los reportes, ponderada por estrato)',
      valor: p.veracidadBase,
      n: p.veracidad.length,
    },
    {
      hipotesis: 'H1c',
      indicador: 'exhaustividad (reales confirmados / reales)',
      tipo: 'costo',
      vista: 'PROCESADA',
      unidad: 'proporción',
      valor: proporcion(reales.filter((v) => v.confirmado).length, reales.length),
      n: reales.length,
    },
    {
      hipotesis: 'H1c',
      indicador: 'minutos hasta la confirmación',
      tipo: 'costo',
      vista: 'PROCESADA',
      unidad: 'min (mediana)',
      valor: mediana(p.latencias),
      n: p.latencias.length,
    },
    costo(p.costos, 'no verificables'),
    {
      hipotesis: 'H1d',
      indicador: 'minutos visible tras el fin',
      tipo: 'beneficio',
      vista: 'PROCESADA',
      unidad: 'min (mediana)',
      valor: mediana(p.vigencia.map((v) => v.exceso_procesada_min)),
      n: p.vigencia.length,
    },
    {
      hipotesis: 'H1d',
      indicador: 'minutos visible tras el fin',
      tipo: 'beneficio',
      vista: 'BASE',
      unidad: 'min (mediana)',
      valor: mediana(p.vigencia.map((v) => v.exceso_base_min)),
      n: p.vigencia.length,
    },
    costo(p.costos, 'caducidad prematura'),
    {
      hipotesis: 'H1d',
      indicador: 'minutos de anticipo',
      tipo: 'costo',
      vista: 'PROCESADA',
      unidad: 'min (mediana)',
      valor: mediana(anticipos),
      n: anticipos.length,
    },
  ];
}

/**
 * Lo que sale del registro, el etiquetado y la verificación, sin las tareas: es lo que el análisis
 * de sensibilidad recalcula con otros parámetros.
 */
export function analizarRegistro(
  datos: DatosDeEvaluacion,
  ttlPorCategoria: ReadonlyMap<string, number>,
): ResultadoDelRegistro {
  const referencia = construirReferencia(datos);
  const vidaDe = vidas(datos);
  const unicos = incidentesUnicos(datos, referencia);
  const poblacion = reportesDeLaComunidad(datos, vidaDe);
  const {
    veracidad,
    latencias,
    costos: costosDeVeracidad,
  } = analizarVeracidad(referencia, poblacion);
  const vigencia = filasDeVigencia(unicos, referencia, vidaDe);
  const incidentes = filasDeIncidentes(unicos);
  const costos: FilaDeCosto[] = [
    fusionesErroneas(datos, referencia),
    ...costosDeVeracidad,
    {
      hipotesis: 'H1d',
      indicador: 'caducidad prematura',
      casos: vigencia.filter((v) => v.prematuro).length,
      total: vigencia.length,
    },
  ];
  return {
    incidentes,
    veracidad,
    vigencia,
    supervivencia: filasDeSupervivencia(unicos, referencia, vidaDe, ttlPorCategoria),
    costos,
    indicadores: indicadoresDelRegistro({
      incidentes,
      veracidad,
      veracidadBase: veracidadPonderada(poblacion, veracidad),
      latencias,
      vigencia,
      costos,
    }),
  };
}

/** El análisis completo: el registro y las tareas cronometradas. */
export function analizar(
  datos: DatosDeEvaluacion,
  ttlPorCategoria: ReadonlyMap<string, number>,
): ResultadoDelAnalisis {
  const referencia = construirReferencia(datos);
  const { filas, avisos } = analizarTareas(datos, referencia);
  const registro = analizarRegistro(datos, ttlPorCategoria);
  return {
    ...registro,
    tareas: filas,
    avisos,
    indicadores: [...indicadoresDeTareas(filas), ...registro.indicadores],
  };
}
