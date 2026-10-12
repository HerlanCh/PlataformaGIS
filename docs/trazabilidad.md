# Matriz de Trazabilidad de Requisitos

Esta matriz vincula requisito → historia → caso de prueba: los requisitos funcionales (RF) del [`srs.md`](srs.md), las historias de usuario (HU), los módulos y casos de uso que los implementan, y las pruebas asociadas. Se actualiza incrementalmente en cada fase del roadmap.

Los nombres de casos de uso provienen del roadmap; los marcados "por definir" se nombran en la fase que los implementa. `apps/web` y `apps/bot` son adaptadores de entrada, no módulos: no contienen lógica de negocio.

---

## 1. Trazabilidad de Historias de Usuario (Funcional)

| Requisito | ID Historia | Nombre de la Historia | Módulo | Caso de Uso (`application/`) | Caso de Prueba | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| RF-01<br>RF-02<br>RF-03 | **HU-01** | Crear reporte en dos toques con ubicación automática | `identity`<br>`reports`<br>`verification` | `RegisterDevice`<br>`CreateReport` | `HU-01: crea reporte activo con coordenadas válidas`<br>`HU-01: un duplicado se registra como confirmación`<br>`HU-01: rechaza coordenadas fuera del rectángulo`<br>`HU-01: un duplicado del propio autor no crea reporte ni voto`<br>`HU-01: rechaza al superar el límite de creación` | Especificado (Fase 0) |
| RF-04<br>RF-05<br>RF-06 | **HU-02** | Ver reportes activos en mapa en tiempo real | `reports` | `ListReportsInViewport` | `HU-02: filtra por viewport y estados vigentes`<br>`HU-02: difunde el reporte a los clientes de su celda`<br>`HU-02: usa el centro de la celda en categoría sensible`<br>`HU-02: la respuesta no contiene location ni author_id` | Especificado (Fase 0) |
| RF-07<br>RF-08 | **HU-03** | Confirmar o negar un reporte ("¿Sigue ahí?") | `verification`<br>`reports` | `ConfirmReport`<br>`DenyReport` | `HU-03: confirma al alcanzar el umbral ponderado y extiende la vigencia`<br>`HU-03: resuelve al acumular negaciones`<br>`HU-03: el autor no puede votar su propio reporte`<br>`HU-03: un solo votante no confirma`<br>`HU-03: rechaza un voto repetido`<br>`HU-03: rechaza el voto de un usuario lejano`<br>`HU-03: aplica la segunda extensión y ninguna más` | Especificado (Fase 0) |
| RF-09 | **HU-04** | Caducidad automática por categoría | `reports` | `ExpireReports` | `HU-04: pasa a CADUCADO al vencer el TTL`<br>`HU-04: no caduca antes de expires_at`<br>`HU-04: un reporte CONFIRMADO vencido también caduca` | Especificado (Fase 0) |
| RF-10 | **HU-05** | Reportar sin conexión y enviar al reconectar | `reports` | `CreateReport` (idempotente) | `HU-05: guarda el reporte en la cola local sin conexión`<br>`HU-05: envía la cola al reconectar`<br>`HU-05: procesa una solicitud repetida exactamente una vez` | Especificado (Fase 0) |
| RF-11 | **HU-06** | Mapa de calor espacial agregado | `heatmap` | `GetHeatmap` | `HU-06: descarta celdas con menos de 3 reportes`<br>`HU-06: incluye celdas con 3 o más reportes` | Especificado (Fase 0) |
| RF-12 | **HU-07** | Suscripción a zonas de interés | `subscriptions` | `SubscribeZone`<br>`UnsubscribeZone` | `HU-07: guarda una zona válida`<br>`HU-07: rechaza un radio fuera de rango`<br>`HU-07: rechaza al superar el límite de zonas`<br>`HU-07: elimina una zona` | Especificado (Fase 0) |
| RF-13 | **HU-08** | Notificaciones de incidentes cercanos | `notifications`<br>`subscriptions` | `NotifySubscribers` | `HU-08: notifica a los suscriptores de la zona y categoría`<br>`HU-08: no notifica fuera de la zona o de la categoría`<br>`HU-08: notifica una sola vez por reporte`<br>`HU-08: no notifica al autor` | Especificado (Fase 0) |
| RF-01<br>RF-14 | **HU-09** | Bot de Telegram para consulta y reporte | `identity`<br>`reports`<br>`verification`<br>`subscriptions` | `RegisterDevice`<br>`CreateReport`<br>`ConfirmReport` / `DenyReport`<br>`SubscribeZone` | `HU-09: /start vincula la cuenta de Telegram`<br>`HU-09: /reportar crea un reporte con la ubicación compartida`<br>`HU-09: /cerca lista los reportes a 1 km`<br>`HU-09: /zona crea una zona suscrita` | Especificado (Fase 0) |
| RF-15 | **HU-10** | Clasificación automática de reportes sospechosos | `classifier` | Por definir (Fase 10) | `HU-10: marca un reporte con indicios de spam`<br>`HU-10: crear un reporte no depende del clasificador` | Especificado (Fase 0) |
| RF-16 | **HU-11** | Datos abiertos anonimizados | `open-data` | Por definir (Fase 10) | `HU-11: exporta sin usuarios ni puntos exactos`<br>`HU-11: declara la licencia de los datos` | Especificado (Fase 0) |
| RF-08<br>RF-17 | **HU-12** | Moderación y auditoría de incidentes | `moderation`<br>`verification` | `RejectReport` | `HU-12: rechaza con motivo, audita y penaliza al autor`<br>`HU-12: deniega la acción sin rol MODERADOR` | Especificado (Fase 0) |

---

## 2. Trazabilidad de Requisitos No Funcionales (ISO/IEC 25010)

| ID RNF | Característica ISO | Métrica / Umbral | Componente Afectado | Método de Verificación en CI/CD | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **RNF-01** | Modularidad | 0 violaciones de reglas hexagonales | Todos los módulos | `pnpm depcruise` en GitHub Actions | Verificado en CI (Fase 1) |
| **RNF-02** | Analizabilidad | Complejidad ciclomática ≤ 10 | Todas las funciones TS | ESLint `complexity` en CI | Verificado en CI (Fase 1) |
| **RNF-03** | Modificabilidad | Código duplicado < 3 % | Monorepo completo | `jscpd` / SonarCloud | Verificado en CI (Fase 1) |
| **RNF-04** | Capacidad de prueba | Cobertura Dominio ≥ 95 %, App ≥ 85 %, Global ≥ 75 % | Módulos y paquetes | Vitest con cobertura v8 | Verificado en CI (Fase 1) |
| **RNF-05** | Disponibilidad | Disponibilidad ≥ 95 % en piloto | `apps/api` | UptimeRobot a `/health` | Definido |
| **RNF-06** | Tolerancia a fallos | 0 reportes perdidos sin conexión | `apps/web` | Pruebas Playwright con corte de red | Definido |
| **RNF-07** | Recuperabilidad | 1 restauración probada por versión | PostgreSQL / PostGIS | Workflow de GitHub Actions con `pg_dump` y restauración | Definido |
| **RNF-08** | Ausencia de fallos | Tasa errores 5xx < 1 % | `apps/api` | Logs estructurados pino | Definido |
| **RNF-09** | Tiempo de respuesta | Latencia API p95 < 300 ms | Endpoints Fastify | Escenario de prueba en `k6` | Definido |
| **RNF-10** | Difusión de eventos | Difusión WebSocket p95 < 2 s | Socket.io | Artillery (motor Socket.io) con 500 clientes | Definido |
| **RNF-11** | Consulta espacial | Consulta espacial p95 < 100 ms | PostGIS (100k registros) | `EXPLAIN ANALYZE` con la carga sintética | Definido |
| **RNF-12** | Tamaño de bundle | JS inicial PWA < 250 KB | `apps/web` | Lighthouse CI | Definido |
| **RNF-13** | Seguridad | 0 vulnerabilidades altas/críticas | Dependencias y API | `npm audit`, Dependabot, OWASP ZAP | Verificado en CI (Fase 1) |
| **RNF-14** | Privacidad | 0 respuestas públicas con `location` o `author_id` | `apps/api`, Socket.io, datos abiertos | Prueba de privacidad sobre todas las rutas | Definido |

---

## 3. Fase 2: modelo de dominio

Reglas de negocio ya implementadas y probadas en `domain/`. Las pruebas viven en `tests/` de cada módulo (o junto al código en los paquetes compartidos) y llevan el ID de la historia en el nombre.

### 3.1 Reglas de negocio por historia

| Historia | Regla (SRS) | Implementación | Archivo de pruebas |
| :--- | :--- | :--- | :--- |
| HU-01 | Solo se aceptan ubicaciones dentro del área de servicio (1.3) | `GeoPoint` en `shared-kernel` | `packages/shared-kernel/src/geo-point.test.ts` |
| HU-01 | Un reporte nace `ACTIVO` con la caducidad de su categoría (3.1) | `Report.create`, `Category`, `ExpirationPolicy` | `packages/modules/reports/tests/report.test.ts` |
| HU-01, HU-09 | Registro anónimo por dispositivo y vínculo con Telegram | `User` | `packages/modules/identity/tests/user.test.ts` |
| HU-02 | En categorías sensibles se muestra el centro de la celda de 200 m (3.1) | `PrivacyPolicy`, `utm19s` | `packages/modules/reports/tests/privacy-policy.test.ts`, `utm19s.test.ts` |
| HU-02 | Los eventos públicos no llevan ubicación real ni usuarios (RNF-14) | Audiencia de cada evento en `contracts` | `packages/contracts/src/events.test.ts` |
| HU-03 | Reglas para emitir un voto: autor, voto único, 1000 m, reporte vigente (3.2.2) | `Vote.cast` | `packages/modules/verification/tests/vote.test.ts` |
| HU-03 | Confirmar, extender y resolver por votos ponderados y votantes distintos (3.2.3 a 3.2.5) | `VerificationPolicy` | `packages/modules/verification/tests/verification-policy.test.ts` |
| HU-03 | Máquina de estados y extensiones de vigencia, máximo 2 (3.2.4) | `Report` | `packages/modules/reports/tests/report.test.ts` |
| HU-03, HU-12 | Ajustes de reputación, silenciado y recuperación (3.2.6 y 3.2.7) | `Reputation`, `ReputationPolicy` | `packages/modules/verification/tests/reputation.test.ts` |
| HU-04 | Caducidad al vencer el TTL, nunca antes; también en `CONFIRMADO` | `Report.expire`, `ExpirationPolicy` | `packages/modules/reports/tests/report.test.ts`, `expiration-policy.test.ts` |
| HU-12 | Rechazo con motivo; el rechazo por autor silenciado no penaliza | `Report.reject`, `ReputationPolicy` | `report.test.ts`, `reputation.test.ts` |

Quedan para la Fase 5, porque dependen de casos de uso: deduplicación (HU-01), límites de creación y de votos (HU-01), consulta por viewport (HU-02) e idempotencia (HU-05).

### 3.2 Puertos

| Módulo | Puerto | Propósito | Se implementa en |
| :--- | :--- | :--- | :--- |
| `identity` | `UserRepository` | Buscar y guardar usuarios | Fase 3 |
| `reports` | `ReportRepository` | Guardar y recuperar reportes | Fase 3 (consultas espaciales en la Fase 4) |
| `reports` | `CategoryRepository` | Leer categorías | Fase 3 |
| `reports` | `IdGenerator` | Generar identificadores | Fase 5 |
| `reports` | `AuthorStanding` | Saber si el autor está silenciado | Fase 5 (conectado a `verification` en la raíz de composición) |
| `verification` | `VoteRepository` | Guardar y leer votos | Fase 3 |
| `verification` | `ReputationRepository` | Guardar y leer reputaciones | Fase 3 |
| `verification` | `ReportLookup` | Autor, estado, ubicación y extensiones de un reporte | Fase 5 (conectado a `reports` en la raíz de composición) |
| `shared-kernel` | `Clock` | Fecha y hora actuales | Fase 5 |

### 3.3 Eventos de integración

Definidos en `packages/contracts/src/events.ts`. Un evento público puede difundirse a los clientes; uno interno solo circula entre módulos del servidor.

| Evento | Audiencia | Emite | Escucha |
| :--- | :--- | :--- | :--- |
| `ReportCreated.v1` | Pública | `reports` | `notifications`, clientes |
| `ReportConfirmed.v1` | Pública | `reports` | `verification`, `notifications`, clientes |
| `ReportResolved.v1` | Pública | `reports` | `verification`, clientes |
| `ReportExpired.v1` | Pública | `reports` | clientes |
| `ReportRejected.v1` | Pública | `reports` | `verification`, clientes |
| `ReportDuplicateDetected.v1` | Interna | `reports` | `verification` |
| `VoteCast.v1` | Interna | `verification` | `reports` |

## 4. Fase 3: persistencia

Esquema físico y adaptadores que implementan los puertos de la Fase 2. El detalle de tablas y columnas está en [`diccionario-datos.md`](diccionario-datos.md) y el diagrama en [`modelo-datos.puml`](modelo-datos.puml). Las tablas y columnas se llaman en español; el código conserva sus nombres en inglés. Todas las pruebas de esta sección son de integración y corren contra PostGIS real con Testcontainers.

### 4.1 Puertos implementados

| Módulo | Puerto | Adaptador | Tablas | Archivo de pruebas |
| :--- | :--- | :--- | :--- | :--- |
| `identity` | `UserRepository` | `PgUserRepository` | `usuarios` | `packages/modules/identity/tests/user-repository.integration.test.ts` |
| `reports` | `ReportRepository` | `PostgisReportRepository` | `reportes` | `packages/modules/reports/tests/persistence.integration.test.ts` |
| `reports` | `CategoryRepository` | `PgCategoryRepository` | `categorias` | `packages/modules/reports/tests/persistence.integration.test.ts` |
| `reports` | `ReportUnitOfWork` | `PgReportUnitOfWork` | `reportes`, `eventos_salida` | `packages/modules/reports/tests/persistence.integration.test.ts` |
| `verification` | `VoteRepository` | `PgVoteRepository` | `votos` | `packages/modules/verification/tests/persistence.integration.test.ts` |
| `verification` | `ReputationRepository` | `PgReputationRepository` | `reputaciones` | `packages/modules/verification/tests/persistence.integration.test.ts` |
| `subscriptions` | `SubscriptionRepository` | `PgSubscriptionRepository` | `zonas_suscritas` | `packages/modules/subscriptions/tests/persistence.integration.test.ts` |

`acciones_moderacion` solo tiene tabla en esta fase; la prueba `packages/modules/moderation/tests/migrations.integration.test.ts` cubre sus restricciones.

### 4.2 Requisitos garantizados por la base de datos

| Requisito | Garantía | Mecanismo | Archivo de pruebas |
| :--- | :--- | :--- | :--- |
| HU-03 | Un solo voto por usuario y reporte, también si llegan dos a la vez | Clave primaria (`id_reporte`, `id_usuario`) en `votos`; el adaptador la traduce a `AlreadyVotedError` | `verification/tests/persistence.integration.test.ts` |
| HU-03, HU-12 | La reputación y el peso de un voto están entre 0 y 5 | `CHECK` en `reputaciones.puntaje` y `votos.peso` | `verification/tests/persistence.integration.test.ts` |
| HU-03, HU-04 | Un reporte solo puede estar en uno de los cinco estados y usar hasta 2 extensiones | `CHECK` en `reportes.estado` y `reportes.extensiones` | `reports/tests/persistence.integration.test.ts` |
| HU-05 | Una clave de idempotencia no se repite | Índice único en `reportes.clave_idempotencia`; el dominio valida su formato | `reports/tests/persistence.integration.test.ts`, `idempotency-key.test.ts` |
| HU-07 | El radio de una zona está entre 100 m y 2000 m y la zona tiene al menos una categoría | `ZoneSubscription` en el dominio y `CHECK` en `zonas_suscritas` | `subscriptions/tests/zone-subscription.test.ts`, `persistence.integration.test.ts` |
| HU-12 | Todo rechazo de moderación lleva su motivo | `CHECK` en `acciones_moderacion` | `moderation/tests/migrations.integration.test.ts` |
| RNF-14 | La ubicación real y la pública se guardan por separado; la pública es la que decidió el dominio | Columnas `ubicacion` y `ubicacion_publica`; el repositorio no la recalcula | `reports/tests/persistence.integration.test.ts` |
| Atomicidad | Si falla la escritura del evento, el reporte tampoco se guarda | `PgReportUnitOfWork`: una sola transacción con el outbox | `reports/tests/persistence.integration.test.ts` |
| ADR-001 | Un módulo apagado no crea sus tablas y el resto del esquema queda completo | Un historial de migraciones por módulo | `apps/api/src/migrations.integration.test.ts` |
| ADR-001 | Sin claves foráneas entre módulos | Solo existe `reportes.codigo_categoria → categorias.codigo`, dentro de `reports` | Revisión de las migraciones |

### 4.3 Migraciones

Cada conjunto (plataforma y cada módulo) se aplica sobre una base vacía, se revierte y se vuelve a aplicar en su prueba de integración. `apps/api/src/migrations.integration.test.ts` aplica el esquema completo desde cero en cada ejecución de la CI.
