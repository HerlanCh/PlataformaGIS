import { fileURLToPath } from 'node:url';
import type { DefinicionDeModulo } from '@gis/platform';

/** Punto de entrada público del módulo `evaluation`. Solo lo importa la raíz de composición. */
export const evaluationModulo: DefinicionDeModulo = {
  nombre: 'evaluation',
  migraciones: {
    nombre: 'evaluation',
    carpeta: fileURLToPath(new URL('./migrations', import.meta.url)),
  },
  registrar() {
    // Aquí se registran las rutas, los manejadores de eventos y las tareas del módulo.
  },
};

// Interfaz pública para la raíz de composición: manejador, casos de uso y adaptador (ADR-007).
export { RegistrarEventoDeEvaluacion } from './application/registrar-evento-de-evaluacion.js';
export { ConsultarEstadoDelRegistro } from './application/consultar-estado-del-registro.js';
export type { EntradaConsultarEstadoDelRegistro } from './application/consultar-estado-del-registro.js';
export { RepositorioEvaluacionPg } from './adapters/repositorio-evaluacion-pg.js';
export type { RepositorioDeEvaluacion } from './domain/ports.js';
export type { Envio, EstadoDelRegistro, Transicion, VotoRegistrado } from './domain/registro.js';
