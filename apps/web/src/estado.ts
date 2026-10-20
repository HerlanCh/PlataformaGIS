// Estado local mínimo de la interfaz (Zustand). Lo que viene del servidor vive en TanStack Query.
import { create } from 'zustand';
import type { CodigoCategoria } from './domain/categorias.js';
import { SIN_FILTROS } from './domain/filtros.js';
import type { Antiguedad, Filtros } from './domain/filtros.js';
import type { Caja, Punto } from './domain/geo.js';
import type { EstadoDeConexion } from './services/tiempo-real.js';

export type TonoDeAviso = 'exito' | 'info' | 'problema';

export interface Aviso {
  readonly id: number;
  readonly tono: TonoDeAviso;
  readonly texto: string;
  /** Reporte recién creado al que el aviso ofrece añadir un detalle. */
  readonly idParaDescribir?: string;
}

export type Capa = 'incidentes' | 'calor';
export type DiasDeCalor = 7 | 30 | 90;

/** Zona que se está dibujando: el centro es el del mapa, bajo la mira. */
export interface ZonaEnEdicion {
  readonly radioM: number;
  readonly centro: Punto | null;
}

export const RADIO_INICIAL_M = 500;

interface EstadoApp {
  readonly ventana: Caja | null;
  readonly posicion: Punto | null;
  readonly conexion: EstadoDeConexion;
  readonly hojaAbierta: boolean;
  readonly pendientes: number;
  readonly aviso: Aviso | null;
  /** Reporte cuyo detalle está abierto. */
  readonly detalle: string | null;
  readonly filtros: Filtros;
  readonly filtrosAbiertos: boolean;
  readonly capa: Capa;
  readonly diasDeCalor: DiasDeCalor;
  /** La API no ofrece el mapa de calor (módulo apagado): se esconde el interruptor. */
  readonly calorDisponible: boolean;
  readonly zonasAbiertas: boolean;
  readonly zonaEnEdicion: ZonaEnEdicion | null;
  /** Punto que el mapa debe dejar a la vista (por ejemplo, el del «¿Sigue ahí?»). */
  readonly enfoque: Punto | null;
  readonly instalarAbierta: boolean;
  /** Reporte al que llevar el mapa (al tocar un aviso push): se abre su detalle al cargarlo. */
  readonly destino: { readonly idReporte: string; readonly punto: Punto } | null;
  /** Reporte propio cuya hoja de descripción está abierta. */
  readonly describiendo: string | null;
  fijarVentana(ventana: Caja): void;
  fijarPosicion(posicion: Punto): void;
  fijarConexion(conexion: EstadoDeConexion): void;
  abrirHoja(): void;
  cerrarHoja(): void;
  fijarPendientes(pendientes: number): void;
  avisar(tono: TonoDeAviso, texto: string, idParaDescribir?: string): void;
  descartarAviso(): void;
  abrirDetalle(idReporte: string): void;
  cerrarDetalle(): void;
  alternarLinea(codigo: CodigoCategoria): void;
  fijarAntiguedad(antiguedad: Antiguedad): void;
  quitarFiltros(): void;
  abrirFiltros(): void;
  cerrarFiltros(): void;
  fijarCapa(capa: Capa): void;
  fijarDiasDeCalor(dias: DiasDeCalor): void;
  marcarCalorNoDisponible(): void;
  abrirZonas(): void;
  cerrarZonas(): void;
  empezarZona(): void;
  fijarRadio(radioM: number): void;
  fijarCentroZona(centro: Punto): void;
  terminarZona(): void;
  enfocar(punto: Punto | null): void;
  abrirInstalar(): void;
  cerrarInstalar(): void;
  irAReporte(idReporte: string, punto: Punto): void;
  limpiarDestino(): void;
  abrirDescripcion(idReporte: string): void;
  cerrarDescripcion(): void;
}

const CLAVE_FILTROS = 'alerta-lp:filtros';

/** Filtros recordados en este navegador. Si el almacenamiento falla, se empieza sin filtros. */
function filtrosGuardados(): Filtros {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE_FILTROS) ?? 'null') as Filtros | null;
    if (guardados && Array.isArray(guardados.ocultas)) return guardados;
  } catch {
    // Sin almacenamiento disponible (navegación privada, datos bloqueados).
  }
  return SIN_FILTROS;
}

function guardarFiltros(filtros: Filtros): Filtros {
  try {
    localStorage.setItem(CLAVE_FILTROS, JSON.stringify(filtros));
  } catch {
    // No recordar los filtros no impide usarlos.
  }
  return filtros;
}

let siguienteAviso = 1;

export const useEstado = create<EstadoApp>((set) => ({
  ventana: null,
  posicion: null,
  conexion: 'conectando',
  hojaAbierta: false,
  pendientes: 0,
  aviso: null,
  detalle: null,
  filtros: filtrosGuardados(),
  filtrosAbiertos: false,
  capa: 'incidentes',
  diasDeCalor: 30,
  calorDisponible: true,
  zonasAbiertas: false,
  zonaEnEdicion: null,
  enfoque: null,
  instalarAbierta: false,
  destino: null,
  describiendo: null,
  fijarVentana: (ventana) => set({ ventana }),
  // Con una posición nueva, un aviso viejo de «no pudimos obtener tu ubicación» ya no es cierto.
  fijarPosicion: (posicion) =>
    set(({ aviso }) => ({
      posicion,
      aviso: aviso?.tono === 'problema' && aviso.texto.includes('ubicación') ? null : aviso,
    })),
  fijarConexion: (conexion) => set({ conexion }),
  abrirHoja: () => set({ hojaAbierta: true }),
  cerrarHoja: () => set({ hojaAbierta: false }),
  fijarPendientes: (pendientes) => set({ pendientes }),
  avisar: (tono, texto, idParaDescribir) =>
    set({
      aviso: {
        id: siguienteAviso++,
        tono,
        texto,
        ...(idParaDescribir === undefined ? {} : { idParaDescribir }),
      },
    }),
  descartarAviso: () => set({ aviso: null }),
  abrirDetalle: (detalle) => set({ detalle }),
  cerrarDetalle: () => set({ detalle: null }),
  alternarLinea: (codigo) =>
    set(({ filtros }) => ({
      filtros: guardarFiltros({
        ...filtros,
        ocultas: filtros.ocultas.includes(codigo)
          ? filtros.ocultas.filter((c) => c !== codigo)
          : [...filtros.ocultas, codigo],
      }),
    })),
  fijarAntiguedad: (antiguedad) =>
    set(({ filtros }) => ({ filtros: guardarFiltros({ ...filtros, antiguedad }) })),
  quitarFiltros: () => set({ filtros: guardarFiltros(SIN_FILTROS) }),
  abrirFiltros: () => set({ filtrosAbiertos: true }),
  cerrarFiltros: () => set({ filtrosAbiertos: false }),
  fijarCapa: (capa) => set({ capa }),
  fijarDiasDeCalor: (diasDeCalor) => set({ diasDeCalor }),
  marcarCalorNoDisponible: () => set({ calorDisponible: false, capa: 'incidentes' }),
  abrirZonas: () => set({ zonasAbiertas: true }),
  cerrarZonas: () => set({ zonasAbiertas: false }),
  empezarZona: () =>
    set({
      zonasAbiertas: false,
      capa: 'incidentes',
      zonaEnEdicion: { radioM: RADIO_INICIAL_M, centro: null },
    }),
  fijarRadio: (radioM) =>
    set(({ zonaEnEdicion }) =>
      zonaEnEdicion ? { zonaEnEdicion: { ...zonaEnEdicion, radioM } } : {},
    ),
  fijarCentroZona: (centro) =>
    set(({ zonaEnEdicion }) =>
      zonaEnEdicion ? { zonaEnEdicion: { ...zonaEnEdicion, centro } } : {},
    ),
  terminarZona: () => set({ zonaEnEdicion: null }),
  enfocar: (enfoque) => set({ enfoque }),
  abrirInstalar: () => set({ instalarAbierta: true, zonasAbiertas: false }),
  cerrarInstalar: () => set({ instalarAbierta: false }),
  irAReporte: (idReporte, punto) => set({ destino: { idReporte, punto }, capa: 'incidentes' }),
  limpiarDestino: () => set({ destino: null }),
  abrirDescripcion: (describiendo) => set({ describiendo, aviso: null }),
  cerrarDescripcion: () => set({ describiendo: null }),
}));
