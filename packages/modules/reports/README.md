# Módulo `reports`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Crear, deduplicar y caducar reportes de incidentes. Es el único módulo que modifica un reporte: aplica su máquina de estados, calcula su caducidad y decide qué ubicación se muestra al público.

No decide si un reporte se confirma o se resuelve: eso lo decide `verification` y este módulo lo aplica.

## Modelo de dominio

| Elemento           | Tipo          | Qué hace                                                                                                  |
| :----------------- | :------------ | :-------------------------------------------------------------------------------------------------------- |
| `Report`           | Agregado raíz | Ciclo de vida del reporte: `ACTIVO → CONFIRMADO`, y de ambos a `RESUELTO`, `CADUCADO` o `RECHAZADO`       |
| `Category`         | Entidad       | Código, nombre, TTL, radio de deduplicación y si es sensible. `MVP_CATEGORIES` trae las cinco del SRS 3.1 |
| `ExpirationPolicy` | Política pura | Caducidad inicial, extensiones (50 % del TTL, máximo 2) y comprobación de vencimiento                     |
| `PrivacyPolicy`    | Política pura | Ubicación pública: exacta, o el centro de la celda de 200 m en categorías sensibles                       |

## Eventos que emite

| Evento                       | Audiencia | Cuándo                                                            |
| :--------------------------- | :-------- | :---------------------------------------------------------------- |
| `ReportCreated.v1`           | Pública   | Se crea un reporte                                                |
| `ReportConfirmed.v1`         | Pública   | Pasa a `CONFIRMADO`                                               |
| `ReportResolved.v1`          | Pública   | Pasa a `RESUELTO`                                                 |
| `ReportExpired.v1`           | Pública   | Pasa a `CADUCADO`                                                 |
| `ReportRejected.v1`          | Pública   | Pasa a `RECHAZADO`, con motivo `MODERACION` o `AUTOR_SILENCIADO`  |
| `ReportDuplicateDetected.v1` | Interna   | Un reporte nuevo cae en el radio de deduplicación de otro vigente |

Los eventos públicos solo llevan `publicLocation`: nunca la ubicación real ni el autor.

## Eventos que escucha

| Evento        | Qué hace                                                              |
| :------------ | :-------------------------------------------------------------------- |
| `VoteCast.v1` | Aplica la decisión que trae: `CONFIRM`, `EXTEND` o `RESOLVE` (Fase 5) |

## Puertos

| Puerto               | Para qué                                                                                |
| :------------------- | :-------------------------------------------------------------------------------------- |
| `ReportRepository`   | Guardar y recuperar reportes. Las consultas espaciales se añaden en la Fase 4           |
| `CategoryRepository` | Leer las categorías                                                                     |
| `IdGenerator`        | Generar identificadores                                                                 |
| `AuthorStanding`     | Saber si el autor está silenciado. Lo conecta la raíz de composición con `verification` |

## Interfaz pública

`reportsModule` en `index.ts`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`reports` y `categories` (Fase 3).

## Interruptor

Ninguno: es un módulo imprescindible y siempre está activo.
