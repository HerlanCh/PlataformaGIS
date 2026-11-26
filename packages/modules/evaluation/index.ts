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

// Interfaz pública para la raíz de composición: manejador, casos de uso y adaptadores (ADR-007).
export { RegistrarEventoDeEvaluacion } from './application/registrar-evento-de-evaluacion.js';
export { ConsultarEstadoDelRegistro } from './application/consultar-estado-del-registro.js';
export type { EntradaConsultarEstadoDelRegistro } from './application/consultar-estado-del-registro.js';
export { ConsultarVistas } from './application/consultar-vistas.js';
export type { EntradaConsultarVistas } from './application/consultar-vistas.js';
export {
  CongelarInstantanea,
  ListarInstantaneas,
  ObtenerInstantanea,
} from './application/instantaneas.js';
export type {
  DependenciasDeInstantaneas,
  EntradaCongelarInstantanea,
  EntradaListarInstantaneas,
  EntradaObtenerInstantanea,
} from './application/instantaneas.js';
export { CrearSesion, IniciarTarea, ListarSesiones, TerminarTarea } from './application/tareas.js';
export type {
  DependenciasDeTareas,
  EntradaCrearSesion,
  EntradaTerminarTarea,
  TareaEnCurso,
} from './application/tareas.js';
export {
  GuardarEtiquetas,
  ListarEnviosParaEtiquetar,
  MedirAcuerdo,
} from './application/etiquetado.js';
export type { EntradaGuardarEtiquetas, EnviosParaEtiquetar } from './application/etiquetado.js';
export {
  ListarVerificaciones,
  RegistrarVerificacion,
  SortearReportes,
} from './application/verificacion.js';
export type { EntradaRegistrarVerificacion } from './application/verificacion.js';
export { ExportarEvaluacion } from './application/exportar-evaluacion.js';
export { RepositorioEvaluacionPg } from './adapters/repositorio-evaluacion-pg.js';
export { RepositorioExportacionPg } from './adapters/repositorio-exportacion-pg.js';
export { aCsv as exportacionACsv, COLUMNAS_EXPORTADAS } from './domain/exportacion.js';
export type { Exportacion, Fila, NombreDeTabla } from './domain/exportacion.js';
export {
  RepositorioEtiquetasPg,
  RepositorioSesionesPg,
  RepositorioVerificacionesPg,
} from './adapters/repositorio-herramientas-pg.js';
export { RepositorioInstantaneasPg } from './adapters/repositorio-instantaneas-pg.js';
export type { RepositorioDeEvaluacion, RepositorioDeInstantaneas } from './domain/ports.js';
export { MAX_NOMBRE_DE_INSTANTANEA } from './domain/instantanea.js';
export type { Instantanea, ResumenDeInstantanea } from './domain/instantanea.js';
export { reconstruirVistas, VENTANA_BASE_MS } from './domain/vistas.js';
export type { Caja, PuntoBase, PuntoProcesado, Vistas } from './domain/vistas.js';
export type { Envio, EstadoDelRegistro, Transicion, VotoRegistrado } from './domain/registro.js';
export { DURACION_DE_TAREA_MS, SECUENCIAS } from './domain/tarea.js';
export type { Marca, Sesion, Tarea, Vista } from './domain/tarea.js';
export { KAPPA_MINIMO } from './domain/etiquetado.js';
export type { Acuerdo, EnvioEtiquetable, Etiqueta, Evaluador } from './domain/etiquetado.js';
export type { ReporteVerificable, Sorteo, Verificacion } from './domain/verificacion.js';
