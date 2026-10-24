# Módulo `classifier`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Marca los reportes con indicios de spam, de falsedad o con datos de personas, para que un moderador los revise primero (HU-10). Clasifica de forma asíncrona, tras el outbox: crear un reporte nunca espera al clasificador.

## Modelo de dominio

| Elemento              | Tipo         | Qué hace                                                                                   |
| :-------------------- | :----------- | :----------------------------------------------------------------------------------------- |
| `Clasificador`        | Puerto       | El `ClassifierPort` del roadmap: decide si un reporte merece revisión                      |
| `clasificarPorReglas` | Función pura | Suma el peso de cada indicio, hasta 1, y marca el reporte desde `UMBRAL_DE_SOSPECHA` (0,5) |

Indicios y pesos:

| Motivo                 | Peso | Cuándo                                                                |
| :--------------------- | :--- | :-------------------------------------------------------------------- |
| `ENLACE`               | 0,6  | Una URL o un dominio                                                  |
| `SPAM`                 | 0,5  | Una palabra de publicidad o estafa (`gratis`, `promo`, `préstamo`…)   |
| `DATOS_PERSONALES`     | 0,6  | Celular, correo, número de carné o placa: la regla ética de la Fase 0 |
| `FRECUENCIA_DEL_AUTOR` | 0,5  | 4 reportes o más del mismo autor en una hora                          |
| `TEXTO_REPETITIVO`     | 0,3  | Un carácter seis veces seguidas, o pocas palabras distintas           |
| `LONGITUD_ANORMAL`     | 0,2  | Menos de 4 caracteres, o una tira de más de 40 sin espacios           |

## Casos de uso (Fase 10)

`ClasificarReporte`: manejador de `ReporteCreado` (v1 y v2) y `DescripcionAgregada.v1`. No clasifica los incidentes de fuente oficial (HU-13). Pide los datos por `ConsultaParaClasificar`, clasifica y guarda el resultado con `ReporteClasificado.v1` en una transacción.

## Adaptadores

| Adaptador                        | Qué hace                                                                                           |
| :------------------------------- | :------------------------------------------------------------------------------------------------- |
| `ClasificadorPorReglas`          | Las reglas locales (`reglas-v1`). Va a producción primero                                          |
| `ClasificadorConRespaldo`        | Usa el principal (el modelo de IA de la Fase 13) y, si falla o tarda más que el límite, las reglas |
| `UnidadDeTrabajoClasificacionPg` | Guarda la clasificación y su evento en una transacción                                             |

## Evaluación (roadmap 10, IA)

| Comando                                      | Qué hace                                                                                                                                                                                                                              |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm clasificador:evaluar [conjunto.jsonl]` | `EvaluarClasificador` mide precisión y exhaustividad sobre la partición de prueba (30 %, por un hash estable del texto) y regenera `docs/clasificador/evaluacion.md`. Sin argumento usa `tools/clasificador/conjunto-sintetico.jsonl` |
| `pnpm clasificador:exportar <archivo.jsonl>` | `ExportarConjuntoEtiquetado` escribe la última decisión de moderación de cada reporte descrito: `RECHAZAR` → `SOSPECHOSO`, `MANTENER` → `NORMAL`. Solo texto y etiqueta                                                               |

El modelo de IA de la Fase 13 reemplaza a las reglas solo si las supera en esta misma medición.

## Eventos que emite

| Evento                  | Audiencia | Cuándo                                                                 |
| :---------------------- | :-------- | :--------------------------------------------------------------------- |
| `ReporteClasificado.v1` | Interna   | Tras cada clasificación; `sospechoso` lo lleva a la cola de moderación |

## Eventos que escucha

`ReporteCreado.v1`, `ReporteCreado.v2` y `DescripcionAgregada.v1`, todos de `reports`.

## Puertos

| Puerto                           | Para qué                                                                                                                  |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `ConsultaParaClasificar`         | Descripción privada del reporte y reportes del autor en la hora anterior. Lo conecta la raíz de composición con `reports` |
| `UnidadDeTrabajoDeClasificacion` | Guardar la clasificación y sus eventos en una transacción                                                                 |

## Interfaz pública

`classifierModulo` en `index.ts`, junto con `ClasificarReporte`, los adaptadores y los tipos del puerto. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`clasificaciones`: historial de clasificaciones. Columnas en `docs/diccionario-datos.md`.

## Interruptor

`FEATURE_CLASSIFIER` (los módulos imprescindibles no tienen interruptor).

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
