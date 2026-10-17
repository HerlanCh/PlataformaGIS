import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `verification`. Solo lo importa la raíz de composición. */
export const verificationModulo: DefinicionDeModulo = {
  nombre: 'verification',
  migraciones: {
    nombre: 'verification',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};

// Interfaz pública para la raíz de composición: casos de uso, manejadores, adaptadores y puertos.
export { AjustarReputacionPorDesenlace } from './application/ajustar-reputacion-por-desenlace.js';
export type { DependenciasAjustarReputacion } from './application/ajustar-reputacion-por-desenlace.js';
export type { DependenciasDeVoto, VotoRegistrado } from './application/emitir-voto.js';
export type { UnidadDeTrabajoDeVoto } from './application/ports.js';
export { RegistrarConfirmacionPorDuplicado } from './application/registrar-confirmacion-por-duplicado.js';
export { ConfirmarReporte, LIMITE_DE_VOTOS, NegarReporte } from './application/votar-reporte.js';
export type { DependenciasVotarReporte, EntradaVotarReporte } from './application/votar-reporte.js';
export { RepositorioReputacionesPg } from './adapters/reputation-repository.js';
export { UnidadDeTrabajoVotoPg } from './adapters/unidad-de-trabajo-voto.js';
export { RepositorioVotosPg } from './adapters/vote-repository.js';
export type { ConsultaDeReporte } from './domain/ports.js';
export type { InstantaneaDeReporte } from './domain/report-snapshot.js';
