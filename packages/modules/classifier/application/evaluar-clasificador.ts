import type { Clasificador } from '../domain/clasificacion.js';
import { calcularMetricas, esDePrueba } from '../domain/evaluacion.js';
import type { Ejemplo, Etiqueta, Metricas } from '../domain/evaluacion.js';

export interface FalloDeEvaluacion {
  readonly texto: string;
  readonly esperado: Etiqueta;
  readonly motivos: readonly string[];
}

export interface ResultadoDeEvaluacion {
  readonly clasificador: string;
  readonly ejemplosDePrueba: number;
  readonly metricas: Metricas;
  /** Falsos positivos y falsos negativos, para revisar las reglas. */
  readonly fallos: readonly FalloDeEvaluacion[];
}

/**
 * HU-10: mide un clasificador sobre la partición de prueba del conjunto etiquetado. Sirve para
 * comparar las reglas con el modelo de IA de la Fase 13: el modelo solo reemplaza a las reglas si
 * las supera en esta misma medición.
 */
export class EvaluarClasificador {
  constructor(private readonly clasificador: Clasificador) {}

  async ejecutar(ejemplos: readonly Ejemplo[]): Promise<ResultadoDeEvaluacion> {
    const prueba = ejemplos.filter((e) => esDePrueba(e.texto));
    const resultados = [];
    const fallos: FalloDeEvaluacion[] = [];
    let nombre = 'sin ejemplos';
    for (const ejemplo of prueba) {
      // Cada ejemplo es un reporte aislado: el autor no tiene otros recientes.
      const clasificacion = await this.clasificador.clasificar({
        descripcion: ejemplo.texto,
        reportesRecientesDelAutor: 1,
      });
      nombre = clasificacion.clasificador;
      resultados.push({ esperado: ejemplo.etiqueta, marcado: clasificacion.sospechoso });
      if (clasificacion.sospechoso !== (ejemplo.etiqueta === 'SOSPECHOSO')) {
        fallos.push({
          texto: ejemplo.texto,
          esperado: ejemplo.etiqueta,
          motivos: clasificacion.motivos,
        });
      }
    }
    return {
      clasificador: nombre,
      ejemplosDePrueba: prueba.length,
      metricas: calcularMetricas(resultados),
      fallos,
    };
  }
}
