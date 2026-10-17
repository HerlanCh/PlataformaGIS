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

## Casos de uso (Fase 5)

| Clase                           | Qué hace                                                                                                                                                                                                                                                                                                                                  |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CrearReporte`                  | Crea un reporte (HU-01). Idempotente por `idempotencyKey` (HU-05); 5 por usuario cada 10 minutos; si hay uno vigente de otro usuario cerca devuelve `DUPLICADO` y emite `ReporteDuplicadoDetectado`; si es del mismo autor, `PROPIO_EXISTENTE`. El de un autor silenciado se guarda `RECHAZADO` sin eventos y él lo sigue viendo `ACTIVO` |
| `ListarReportesEnVentana`       | Reportes `ACTIVO` y `CONFIRMADO` no vencidos de la ventana, hasta 500, en su proyección pública (HU-02)                                                                                                                                                                                                                                   |
| `CaducarReportes`               | Caduca los vencidos en lotes de 200 y emite `ReporteCaducado` (HU-04). La programa una tarea periódica (Fase 7)                                                                                                                                                                                                                           |
| `AplicarDecisionDeVerificacion` | Manejador de `VotoEmitido.v1`: confirma, extiende o resuelve                                                                                                                                                                                                                                                                              |
| `AplicarRechazoDeModeracion`    | Manejador de `RechazoDeModeracion.v1`: rechaza con motivo `MODERACION`                                                                                                                                                                                                                                                                    |

Los manejadores son idempotentes: si el reporte ya no admite el cambio, no hacen nada.

## Eventos que emite

| Evento                         | Audiencia | Cuándo                                                            |
| :----------------------------- | :-------- | :---------------------------------------------------------------- |
| `ReporteCreado.v1`             | Pública   | Se crea un reporte                                                |
| `ReporteConfirmado.v1`         | Pública   | Pasa a `CONFIRMADO`                                               |
| `ReporteExtendido.v1`          | Pública   | Recibe la segunda extensión de vigencia                           |
| `ReporteResuelto.v1`           | Pública   | Pasa a `RESUELTO`                                                 |
| `ReporteCaducado.v1`           | Pública   | Pasa a `CADUCADO`                                                 |
| `ReporteRechazado.v1`          | Pública   | Pasa a `RECHAZADO`, con motivo `MODERACION` o `AUTOR_SILENCIADO`  |
| `ReporteDuplicadoDetectado.v1` | Interna   | Un reporte nuevo cae en el radio de deduplicación de otro vigente |

Los eventos públicos solo llevan `publicLocation`: nunca la ubicación real ni el autor.

## Eventos que escucha

| Evento                   | Qué hace                                                          |
| :----------------------- | :---------------------------------------------------------------- |
| `VotoEmitido.v1`         | Aplica la decisión que trae: `CONFIRMAR`, `EXTENDER` o `RESOLVER` |
| `RechazoDeModeracion.v1` | Rechaza el reporte por moderación                                 |

## Puertos

| Puerto                     | Para qué                                                                                                                                    |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `RepositorioDeReportes`    | Guardar y recuperar reportes, y las consultas espaciales: ventana (estados obligatorios y tope de filas), cercanía, duplicados y caducados  |
| `RepositorioDeCategorias`  | Leer las categorías                                                                                                                         |
| `GeneradorDeId`            | Generar identificadores (en `shared-kernel`)                                                                                                |
| `LimitadorDeFrecuencia`    | Límite de creación por usuario (en `shared-kernel`)                                                                                         |
| `ReputacionDelAutor`       | Saber si el autor está silenciado. Lo conecta la raíz de composición con `verification`                                                     |
| `UnidadDeTrabajoDeReporte` | Guardar un reporte y sus eventos en una sola transacción (outbox), o solo eventos. Traduce la clave de idempotencia repetida a un conflicto |

## Interfaz pública

`reportsModulo` en `index.ts`, junto con los casos de uso y manejadores, los adaptadores `RepositorioReportesPostgis`, `RepositorioCategoriasPg` y `UnidadDeTrabajoReportePg`, el catálogo `CATEGORIAS_MVP` y la proyección `ReportePublico`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`reportes` y `categorias`. Columnas, índices y restricciones en `docs/diccionario-datos.md`.

`reportes.id_autor` guarda el ID de un usuario de `identity` sin clave foránea.

El módulo `heatmap` lee `reportes` en modo de solo lectura y solo las columnas `ubicacion_publica`, `estado`, `codigo_categoria` y `creado_en` (ADR-003): renombrarlas exige actualizar su consulta.

## Interruptor

Ninguno: es un módulo imprescindible y siempre está activo.
