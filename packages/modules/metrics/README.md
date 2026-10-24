# Módulo `metrics`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Métricas de uso del piloto (Fase 13, ISO/IEC 12207: validación) sin datos personales:

- reportes creados, comunitarios y oficiales (HU-13), y por categoría;
- tiempo hasta la primera confirmación (mediana y p90);
- porcentaje de reportes comunitarios confirmados;
- porcentaje cerrados por caducidad, por votos o por moderación;
- personas activas por día.

No guarda quién reportó o votó, ni dónde. Solo cuentan los reportes creados desde que se activa el módulo.

## Casos de uso

| Clase                      | Qué hace                                                                                                                                      |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `RegistrarEventoDeReporte` | Manejador de los eventos del reporte: guarda cada hito con la hora del evento. Solo el primero de cada hito cuenta                            |
| `RegistrarActividad`       | Anota la huella del día de quien reporta o vota y consolida los días anteriores. La raíz de composición la llama tras crear o votar con éxito |
| `ConsultarMetricas`        | Resume un periodo de días de Bolivia (rol `MODERADOR`, hasta 366 días) y exporta sus reportes en CSV                                          |

## Eventos que emite

_Ninguno._

## Eventos que escucha

| Evento                                                                  | Qué hace                                         |
| :---------------------------------------------------------------------- | :----------------------------------------------- |
| `ReporteCreado.v1` y `.v2`                                              | Alta del reporte, marcando si es oficial         |
| `VotoEmitido.v1` (solo `CONFIRMACION`) y `ReporteDuplicadoDetectado.v1` | Primera confirmación                             |
| `ReporteConfirmado.v1`                                                  | Paso a `CONFIRMADO`                              |
| `ReporteCaducado.v1`, `ReporteResuelto.v1`, `ReporteRechazado.v1`       | Cierre por caducidad, por votos o por moderación |

## Interfaz pública

`metricsModulo`, los casos de uso, `RepositorioMetricasPg`, `aCsv` y `diaEnLaPaz` en `index.ts`. Ningún otro módulo
la importa: solo la raíz de composición (`apps/*`), que expone `GET /v1/moderacion/metricas` y
`pnpm piloto:metricas <desde> <hasta> [salida.csv]`.

## Tablas propias

`metricas_reportes`, `metricas_actividad` y `metricas_diarias`. Detalle en
[`docs/diccionario-datos.md`](../../../docs/diccionario-datos.md).

## Privacidad

- La huella de actividad es `HMAC-SHA256(sal, "día:idUsuario")`: con el día dentro, dos días no se relacionan.
- La sal es `METRICAS_SAL` o, si falta, una derivada de `JWT_SECRET`.
- Las huellas de un día se borran en cuanto empieza el siguiente; queda solo el conteo.
- El usuario de la prueba de humo no cuenta.

## Interruptor

`FEATURE_METRICS`.

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
