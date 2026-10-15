# Módulo `heatmap`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Mapa de calor (HU-06): agrega los reportes por celda y solo publica las celdas con al menos 3 reportes (`UMBRAL_ANONIMATO`), para no señalar un incidente aislado ni a quien lo reportó.

## Puertos

| Puerto                  | Para qué                                                                                                                    |
| :---------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `ConsultaDeMapaDeCalor` | Celdas con su cantidad de reportes en una ventana, un rango de fechas y unas categorías. La celda mide entre 100 m y 5000 m |

Lo implementa `ConsultaMapaCalorPg` con `ST_SnapToGrid` sobre `ubicacion_publica`. No cuenta los reportes `RECHAZADO`. La cuadrícula es fija para toda la ciudad (`cuadriculaPara`): las celdas no se mueven al desplazar el mapa y una celda cortada por el borde de la ventana se cuenta completa.

## Eventos que emite

_Ninguno todavía._

## Eventos que escucha

_Ninguno todavía._

## Interfaz pública

`heatmapModulo` en `index.ts`, junto con el adaptador `ConsultaMapaCalorPg` y los tipos de la consulta. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

Ninguna. Lee la tabla `reportes` del módulo `reports` como excepción acotada (ADR-003): solo `SELECT` y solo las columnas `ubicacion_publica`, `estado`, `codigo_categoria` y `creado_en`.

## Interruptor

`FEATURE_HEATMAP` (los módulos imprescindibles no tienen interruptor).

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
