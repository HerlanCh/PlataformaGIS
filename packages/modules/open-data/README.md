# Módulo `open-data`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Datos abiertos anonimizados de los reportes terminados (HU-11): la exportación CSV y el resumen de los tableros públicos, con licencia CC BY 4.0. Decisión en el ADR-005.

## Modelo de dominio

| Elemento     | Tipo         | Qué hace                                                                                                                   |
| :----------- | :----------- | :------------------------------------------------------------------------------------------------------------------------- |
| `anonimizar` | Función pura | Convierte un reporte terminado en su fila pública: categoría, celda de 500 m, hora truncada, estado final y si se confirmó |
| `celdaDe`    | Función pura | Centro de la celda de 500 m de un punto, en la misma rejilla que el mapa de calor                                          |
| `LICENCIA`   | Constante    | CC BY 4.0 y la atribución                                                                                                  |

No se publican los reportes vigentes ni los rechazados por silenciado del autor, que nunca fueron públicos.

## Casos de uso

| Clase                    | Qué hace                                                                                                                  |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `RegistrarDatoAbierto`   | Manejador de `ReporteResuelto.v1`, `ReporteCaducado.v1` y `ReporteRechazado.v1`: guarda la fila anonimizada, una sola vez |
| `CargarHistorico`        | Carga por lotes los reportes terminados antes de activar el módulo (`pnpm datos-abiertos:cargar`)                         |
| `ConsultarDatosAbiertos` | El CSV y el resumen: total, confirmados, por categoría y por hora del día en La Paz                                       |

## Eventos que emite

_Ninguno._

## Eventos que escucha

`ReporteResuelto.v1`, `ReporteCaducado.v1` y `ReporteRechazado.v1`, de `reports`.

## Puertos

| Puerto                          | Para qué                                                                                                        |
| :------------------------------ | :-------------------------------------------------------------------------------------------------------------- |
| `ConsultaDeReportesFinalizados` | Datos públicos de un reporte terminado y los IDs del histórico. Lo conecta la raíz de composición con `reports` |
| `RepositorioDeDatosAbiertos`    | La tabla de datos abiertos                                                                                      |

## Interfaz pública

`openDataModulo` en `index.ts`, junto con los casos de uso, `RepositorioDatosAbiertosPg`, `LICENCIA` y los tipos de los puertos. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`datos_abiertos_reportes`. No tiene columnas para el autor, el punto, la descripción ni el ID del reporte. Columnas en `docs/diccionario-datos.md`.

## Interruptor

`FEATURE_OPEN_DATA` (los módulos imprescindibles no tienen interruptor).

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
