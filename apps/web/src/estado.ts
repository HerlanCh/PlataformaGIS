// Estado local mínimo de la interfaz (Zustand). Lo que viene del servidor vive en TanStack Query.
import { create } from 'zustand';
import type { Caja, Punto } from './domain/geo.js';
import type { EstadoDeConexion } from './services/tiempo-real.js';

export type TonoDeAviso = 'exito' | 'info' | 'problema';

export interface Aviso {
  readonly id: number;
  readonly tono: TonoDeAviso;
  readonly texto: string;
}

interface EstadoApp {
  readonly ventana: Caja | null;
  readonly posicion: Punto | null;
  readonly conexion: EstadoDeConexion;
  readonly hojaAbierta: boolean;
  readonly pendientes: number;
  readonly aviso: Aviso | null;
  fijarVentana(ventana: Caja): void;
  fijarPosicion(posicion: Punto): void;
  fijarConexion(conexion: EstadoDeConexion): void;
  abrirHoja(): void;
  cerrarHoja(): void;
  fijarPendientes(pendientes: number): void;
  avisar(tono: TonoDeAviso, texto: string): void;
  descartarAviso(): void;
}

let siguienteAviso = 1;

export const useEstado = create<EstadoApp>((set) => ({
  ventana: null,
  posicion: null,
  conexion: 'conectando',
  hojaAbierta: false,
  pendientes: 0,
  aviso: null,
  fijarVentana: (ventana) => set({ ventana }),
  fijarPosicion: (posicion) => set({ posicion }),
  fijarConexion: (conexion) => set({ conexion }),
  abrirHoja: () => set({ hojaAbierta: true }),
  cerrarHoja: () => set({ hojaAbierta: false }),
  fijarPendientes: (pendientes) => set({ pendientes }),
  avisar: (tono, texto) => set({ aviso: { id: siguienteAviso++, tono, texto } }),
  descartarAviso: () => set({ aviso: null }),
}));
