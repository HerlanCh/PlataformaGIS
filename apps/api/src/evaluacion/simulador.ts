// Simulador de sensibilidad (ADR-007): reprocesa los envíos y los votos del registro con otro
// umbral de confirmación, otros radios de deduplicación y otros tiempos de vida. Es puro y vive en
// la raíz de composición porque usa reglas de dominio de `reports` y `verification`. La decisión
// con un umbral variable se reimplementa; una prueba exige que, con los parámetros del SRS, dé lo
// mismo que los casos de uso reales.
import { FRACCION_DE_EXTENSION, MAX_EXTENSIONES, PoliticaDeCaducidad } from '@gis/module-reports';
import { VERIFICACION } from '@gis/module-verification';
import { PuntoGeo } from '@gis/shared-kernel';
import type { EnvioDato, TransicionDato, VotoDato } from './datos.js';

export interface Parametros {
  readonly umbralDeConfirmacion: number;
  readonly factorDeRadio: number;
  readonly factorDeTtl: number;
}

export const PARAMETROS_DEL_SRS: Parametros = {
  umbralDeConfirmacion: VERIFICACION.umbralDeConfirmacion,
  factorDeRadio: 1,
  factorDeTtl: 1,
};

/** Reputación inicial: el peso de un envío que solo en la simulación pasa a ser un duplicado. */
export const PESO_SUPUESTO = 1;

export interface Categoria {
  readonly ttlMinutos: number;
  readonly radioDuplicadoM: number;
}

export interface Simulacion {
  /** Los envíos con el reporte simulado al que quedaron asignados. */
  readonly envios: readonly EnvioDato[];
  readonly transiciones: readonly TransicionDato[];
}

type Estado = 'ACTIVO' | 'CONFIRMADO' | 'RESUELTO' | 'CADUCADO' | 'RECHAZADO';

interface ReporteSimulado {
  readonly id: string;
  readonly categoria: string;
  readonly ubicacion: PuntoGeo;
  readonly ttlMinutos: number;
  estado: Estado;
  caducaEn: number;
  extensiones: number;
  readonly votos: { readonly valor: VotoDato['valor']; readonly peso: number }[];
}

type Suceso =
  | { readonly tipo: 'envio'; readonly en: number; readonly envio: EnvioDato }
  | { readonly tipo: 'voto'; readonly en: number; readonly voto: VotoDato }
  | { readonly tipo: 'rechazo'; readonly en: number; readonly idReporte: string };

const vigente = (r: ReporteSimulado) => r.estado === 'ACTIVO' || r.estado === 'CONFIRMADO';
const ORDEN_DE_SUCESO = { rechazo: 0, envio: 1, voto: 2 } as const;
const redondear = (valor: number) => Math.round(valor * 100) / 100;

/** Suma ponderada y votantes de un sentido, como `PoliticaDeVerificacion.contar`. */
function contar(r: ReporteSimulado, valor: VotoDato['valor']) {
  const validos = r.votos.filter((v) => v.valor === valor && v.peso > 0);
  return { peso: redondear(validos.reduce((s, v) => s + v.peso, 0)), votantes: validos.length };
}

const alcanza = (conteo: { peso: number; votantes: number }, umbral: number) =>
  conteo.peso >= umbral && conteo.votantes >= VERIFICACION.minVotantesDistintos;

/**
 * `PoliticaDeVerificacion.decidir` con el umbral de confirmación como parámetro. La segunda
 * extensión exige el doble del umbral, como en el SRS (3,0 y 6,0); la resolución no cambia.
 */
function decidir(
  r: ReporteSimulado,
  umbral: number,
): 'NINGUNA' | 'CONFIRMAR' | 'EXTENDER' | 'RESOLVER' {
  if (!vigente(r)) return 'NINGUNA';
  if (alcanza(contar(r, 'NEGACION'), VERIFICACION.umbralDeResolucion)) return 'RESOLVER';
  const confirmaciones = contar(r, 'CONFIRMACION');
  if (r.estado === 'ACTIVO') return alcanza(confirmaciones, umbral) ? 'CONFIRMAR' : 'NINGUNA';
  return r.extensiones < MAX_EXTENSIONES && alcanza(confirmaciones, 2 * umbral)
    ? 'EXTENDER'
    : 'NINGUNA';
}

/** Reprocesa el registro con los parámetros. Los reportes simulados toman el ID de su primer envío. */
export function simular(
  datos: {
    readonly envios: readonly EnvioDato[];
    readonly votos: readonly VotoDato[];
    readonly transiciones: readonly TransicionDato[];
  },
  categorias: ReadonlyMap<string, Categoria>,
  parametros: Parametros,
): Simulacion {
  const reportes = new Map<string, ReporteSimulado>();
  /** Reporte simulado de cada envío. */
  const asignacion = new Map<string, string>();
  const transiciones: TransicionDato[] = [];
  const anotar = (r: ReporteSimulado, en: number, caducaEn: number | null) =>
    transiciones.push({ idReporte: r.id, estado: r.estado, caducaEn, ocurridoEn: en });

  const caducarHasta = (en: number) => {
    for (const r of reportes.values()) {
      if (vigente(r) && PoliticaDeCaducidad.haCaducado(new Date(r.caducaEn), new Date(en))) {
        r.estado = 'CADUCADO';
        anotar(r, r.caducaEn, null);
      }
    }
  };

  const extender = (r: ReporteSimulado, en: number) => {
    r.caducaEn += r.ttlMinutos * FRACCION_DE_EXTENSION * 60_000;
    r.extensiones += 1;
    r.estado = 'CONFIRMADO';
    anotar(r, en, r.caducaEn);
  };

  const votar = (r: ReporteSimulado, valor: VotoDato['valor'], peso: number, en: number) => {
    if (!vigente(r)) return;
    r.votos.push({ valor, peso });
    const decision = decidir(r, parametros.umbralDeConfirmacion);
    if (decision === 'CONFIRMAR' || decision === 'EXTENDER') extender(r, en);
    if (decision === 'RESOLVER') {
      r.estado = 'RESUELTO';
      anotar(r, en, null);
    }
  };

  const duplicadoDe = (envio: EnvioDato, ubicacion: PuntoGeo, en: number) => {
    const radio =
      (categorias.get(envio.codigoCategoria)?.radioDuplicadoM ?? 0) * parametros.factorDeRadio;
    const candidatos = [...reportes.values()]
      .filter((r) => vigente(r) && r.categoria === envio.codigoCategoria && r.caducaEn > en)
      .map((r) => ({ r, distancia: r.ubicacion.distanciaA(ubicacion) }))
      .filter(({ distancia }) => distancia <= radio)
      .toSorted((a, b) => a.distancia - b.distancia);
    return candidatos[0]?.r ?? null;
  };

  const recibir = (envio: EnvioDato, en: number) => {
    const ubicacion = PuntoGeo.crear(envio.latitud, envio.longitud);
    // Un incidente oficial se publica sin deduplicar (HU-13).
    const existente = envio.fuenteOficial === null ? duplicadoDe(envio, ubicacion, en) : null;
    if (existente) {
      asignacion.set(envio.idEnvio, existente.id);
      // El voto de un duplicado real está en el registro; uno que solo aquí es duplicado no lo tiene.
      if (envio.tipo === 'CREADO') votar(existente, 'CONFIRMACION', PESO_SUPUESTO, en);
      return;
    }
    const ttlMinutos = Math.round(
      (categorias.get(envio.codigoCategoria)?.ttlMinutos ?? 0) * parametros.factorDeTtl,
    );
    const r: ReporteSimulado = {
      id: envio.idEnvio,
      categoria: envio.codigoCategoria,
      ubicacion,
      ttlMinutos,
      estado: 'ACTIVO',
      caducaEn: PoliticaDeCaducidad.caducidadInicial(new Date(en), ttlMinutos).getTime(),
      extensiones: 0,
      votos: [],
    };
    reportes.set(r.id, r);
    asignacion.set(envio.idEnvio, r.id);
    anotar(r, en, r.caducaEn);
  };

  /** Un voto o un rechazo del registro van al reporte simulado que tiene el envío que creó el real. */
  const simuladoDe = (idReporteReal: string) => reportes.get(asignacion.get(idReporteReal) ?? '');

  const sucesos: Suceso[] = [
    ...datos.envios.map((envio) => ({ tipo: 'envio' as const, en: envio.recibidoEn, envio })),
    ...datos.votos.map((voto) => ({ tipo: 'voto' as const, en: voto.ocurridoEn, voto })),
    ...datos.transiciones
      .filter((t) => t.estado === 'RECHAZADO')
      .map((t) => ({ tipo: 'rechazo' as const, en: t.ocurridoEn, idReporte: t.idReporte })),
  ].toSorted((a, b) => a.en - b.en || ORDEN_DE_SUCESO[a.tipo] - ORDEN_DE_SUCESO[b.tipo]);

  for (const suceso of sucesos) {
    caducarHasta(suceso.en);
    if (suceso.tipo === 'envio') recibir(suceso.envio, suceso.en);
    else if (suceso.tipo === 'voto') {
      const r = simuladoDe(suceso.voto.idReporte);
      if (r) votar(r, suceso.voto.valor, suceso.voto.peso, suceso.en);
    } else {
      const r = simuladoDe(suceso.idReporte);
      if (r && vigente(r)) {
        r.estado = 'RECHAZADO';
        anotar(r, suceso.en, null);
      }
    }
  }
  caducarHasta(Math.max(0, ...sucesos.map((s) => s.en)));

  return {
    envios: datos.envios.map((e) => ({
      ...e,
      idReporte: asignacion.get(e.idEnvio) ?? e.idReporte,
    })),
    transiciones,
  };
}
