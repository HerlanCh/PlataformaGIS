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
| **RNF-01** | Modularidad | 0 violaciones de reglas hexagonales | Todos los módulos | `pnpm depcruise` en GitHub Actions | Definido |
| **RNF-02** | Analizabilidad | Complejidad ciclomática ≤ 10 | Todas las funciones TS | ESLint `complexity` en CI | Definido |
| **RNF-03** | Modificabilidad | Código duplicado < 3 % | Monorepo completo | `jscpd` / SonarCloud | Definido |
| **RNF-04** | Capacidad de prueba | Cobertura Dominio ≥ 95 %, App ≥ 85 %, Global ≥ 75 % | Módulos y paquetes | Vitest con cobertura v8 | Definido |
| **RNF-05** | Disponibilidad | Disponibilidad ≥ 95 % en piloto | `apps/api` | UptimeRobot a `/health` | Definido |
| **RNF-06** | Tolerancia a fallos | 0 reportes perdidos sin conexión | `apps/web` | Pruebas Playwright con corte de red | Definido |
| **RNF-07** | Recuperabilidad | 1 restauración probada por versión | PostgreSQL / PostGIS | Workflow de GitHub Actions con `pg_dump` y restauración | Definido |
| **RNF-08** | Ausencia de fallos | Tasa errores 5xx < 1 % | `apps/api` | Logs estructurados pino | Definido |
| **RNF-09** | Tiempo de respuesta | Latencia API p95 < 300 ms | Endpoints Fastify | Escenario de prueba en `k6` | Definido |
| **RNF-10** | Difusión de eventos | Difusión WebSocket p95 < 2 s | Socket.io | Artillery (motor Socket.io) con 500 clientes | Definido |
| **RNF-11** | Consulta espacial | Consulta espacial p95 < 100 ms | PostGIS (100k registros) | `EXPLAIN ANALYZE` con la carga sintética | Definido |
| **RNF-12** | Tamaño de bundle | JS inicial PWA < 250 KB | `apps/web` | Lighthouse CI | Definido |
| **RNF-13** | Seguridad | 0 vulnerabilidades altas/críticas | Dependencias y API | `npm audit`, Dependabot, OWASP ZAP | Definido |
| **RNF-14** | Privacidad | 0 respuestas públicas con `location` o `author_id` | `apps/api`, Socket.io, datos abiertos | Prueba de privacidad sobre todas las rutas | Definido |
