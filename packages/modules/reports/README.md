# Módulo `reports`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Crear, deduplicar y caducar reportes de incidentes. Es el único módulo que modifica un reporte: aplica su máquina de estados, calcula su caducidad y decide qué ubicación se muestra al público.

No decide si un reporte se confirma o se resuelve: eso lo decide `verification` y este módulo lo aplica.

## Modelo de dominio

| Elemento               | Tipo          | Qué hace                                                                                                  |
| :--------------------- | :------------ | :-------------------------------------------------------------------------------------------------------- |
| `Reporte`              | Agregado raíz | Ciclo de vida del reporte: `ACTIVO → CONFIRMADO`, y de ambos a `RESUELTO`, `CADUCADO` o `RECHAZADO`       |
| `Categoria`            | Entidad       | Código, nombre, TTL, radio de deduplicación y si es sensible. `MVP_CATEGORIES` trae las cinco del SRS 3.1 |
| `PoliticaDeCaducidad`  | Política pura | Caducidad inicial, extensiones (50 % del TTL, máximo 2) y comprobación de vencimiento                     |
| `PoliticaDePrivacidad` | Política pura | Ubicación pública: exacta, o el centro de la celda de 200 m en categorías sensibles                       |

## Eventos que emite

| Evento                         | Audiencia | Cuándo                                                            |
| :----------------------------- | :-------- | :---------------------------------------------------------------- |
| `ReporteCreado.v1`             | Pública   | Se crea un reporte                                                |
| `ReporteConfirmado.v1`         | Pública   | Pasa a `CONFIRMADO`                                               |
| `ReporteResuelto.v1`           | Pública   | Pasa a `RESUELTO`                                                 |
| `ReporteCaducado.v1`           | Pública   | Pasa a `CADUCADO`                                                 |
| `ReporteRechazado.v1`          | Pública   | Pasa a `RECHAZADO`, con motivo `MODERACION` o `AUTOR_SILENCIADO`  |
| `ReporteDuplicadoDetectado.v1` | Interna   | Un reporte nuevo cae en el radio de deduplicación de otro vigente |

Los eventos públicos solo llevan `publicLocation`: nunca la ubicación real ni el autor.

## Eventos que escucha

| Evento           | Qué hace                                                                   |
| :--------------- | :------------------------------------------------------------------------- |
| `VotoEmitido.v1` | Aplica la decisión que trae: `CONFIRMAR`, `EXTENDER` o `RESOLVER` (Fase 5) |

## Puertos

| Puerto                     | Para qué                                                                                                                                   |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `RepositorioDeReportes`    | Guardar y recuperar reportes, y las consultas espaciales: ventana (estados obligatorios y tope de filas), cercanía, duplicados y caducados |
| `RepositorioDeCategorias`  | Leer las categorías                                                                                                                        |
| `GeneradorDeId`            | Generar identificadores                                                                                                                    |
| `ReputacionDelAutor`       | Saber si el autor está silenciado. Lo conecta la raíz de composición con `verification`                                                    |
| `UnidadDeTrabajoDeReporte` | Guardar un reporte y sus eventos de integración en una sola transacción (outbox)                                                           |

## Interfaz pública

`reportsModulo` en `index.ts`, junto con los adaptadores `RepositorioReportesPostgis` y `RepositorioCategoriasPg`, el catálogo `CATEGORIAS_MVP` y la proyección `ReportePublico`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`reportes` y `categorias`. Columnas, índices y restricciones en `docs/diccionario-datos.md`.

`reportes.id_autor` guarda el ID de un usuario de `identity` sin clave foránea.

El módulo `heatmap` lee `reportes` en modo de solo lectura y solo las columnas `ubicacion_publica`, `estado`, `codigo_categoria` y `creado_en` (ADR-003): renombrarlas exige actualizar su consulta.

## Interruptor

Ninguno: es un módulo imprescindible y siempre está activo.
