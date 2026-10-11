# Matriz de Trazabilidad de Requisitos

Esta matriz vincula los Requisitos del Sistema (SRS y RNF bajo ISO/IEC 25010), las Historias de Usuario (HU), los módulos de arquitectura hexagonal y los casos de prueba asociados. Se actualiza incrementalmente en cada fase del roadmap.

---

## 1. Trazabilidad de Historias de Usuario (Funcional)

| ID Historia | Nombre de la Historia | Módulo Hexagonal | Caso de Uso (`application/`) | Caso de Prueba Unitario / Integración | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **HU-01** | Crear reporte en dos toques con ubicación automática | `reports` | `CreateReport` | `HU-01: debe crear reporte activo con coordenadas válidas`<br>`HU-01: debe deduplicar si existe reporte en radio`<br>`HU-01: debe rechazar fuera del bounding box` | Especificado (Fase 0) |
| **HU-02** | Ver reportes activos en mapa en tiempo real | `reports`<br>`web` | `ListReportsInViewport` | `HU-02: debe filtrar por viewport y estado activo`<br>`HU-02: debe redondear ubicación en categoría sensible` | Especificado (Fase 0) |
| **HU-03** | Confirmar o negar un reporte ("¿Sigue ahí?") | `verification`<br>`reports` | `ConfirmReport`<br>`DenyReport` | `HU-03: debe confirmar reporte al alcanzar umbral ponderado`<br>`HU-03: debe resolver reporte al acumular negaciones`<br>`HU-03: autor no puede votar su propio reporte` | Especificado (Fase 0) |
| **HU-04** | Caducidad automática por categoría | `reports` | `ExpireReports` | `HU-04: debe transicionar a CADUCADO al vencer TTL`<br>`HU-04: no debe caducar antes de expires_at` | Especificado (Fase 0) |
| **HU-05** | Reportar sin conexión y enviar al reconectar | `reports`<br>`web` | `CreateReport` (idempotente) | `HU-05: debe procesar solicitud repetida exactamente una vez por idempotency_key` | Especificado (Fase 0) |
| **HU-06** | Mapa de calor espacial agregado | `heatmap` | `GetHeatmap` | `HU-06: descarta celdas con menos de 3 reportes` | Especificado (Fase 0) |
| **HU-07** | Suscripción a zonas de interés | `subscriptions` | `SubscribeZone`<br>`UnsubscribeZone` | `HU-07: valida radio máximo y persiste geometría` | Especificado (Fase 0) |
| **HU-08** | Notificaciones Push de incidentes cercanos | `notifications` | `NotifySubscribers` | `HU-08: despacha alerta a suscriptores coincidentes` | Especificado (Fase 0) |
| **HU-09** | Bot de Telegram para consulta y reporte | `bot` | `HandleTelegramLocation` | `HU-09: mapea mensaje con ubicación a caso de uso` | Especificado (Fase 0) |
| **HU-10** | Clasificación asistida por reglas o IA | `classifier` | `ClassifyReportText` | `HU-10: clasifica texto a categoría o devuelve null` | Especificado (Fase 0) |
| **HU-11** | Datos abiertos anonimizados | `open-data` | `ExportOpenData` | `HU-11: exporta sin author_id ni coordenadas exactas` | Especificado (Fase 0) |
| **HU-12** | Moderación y auditoría de incidentes | `moderation` | `RejectReport` | `HU-12: rechaza reporte y penaliza reputación de autor` | Especificado (Fase 0) |

---

## 2. Trazabilidad de Requisitos No Funcionales (ISO/IEC 25010)

| ID RNF | Característica ISO | Métrica / Umbral | Componente Afectado | Método de Verificación en CI/CD | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **RNF-01** | Modularidad | 0 violaciones de reglas hexagonales | Todos los módulos | `pnpm depcruise` en GitHub Actions | Definido |
| **RNF-02** | Analizabilidad | Complejidad ciclomática ≤ 10 | Todas las funciones TS | ESLint `complexity` en CI | Definido |
| **RNF-03** | Modificabilidad | Código duplicado < 3 % | Monorepo completo | `jscpd` / SonarCloud | Definido |
| **RNF-04** | Capacidad de prueba | Cobertura Dominio ≥ 95 %, App ≥ 85 % | Módulos y paquetes | Vitest con reporte de cobertura c8/v8 | Definido |
| **RNF-05** | Disponibilidad | Disponibilidad ≥ 95 % en piloto | `apps/api` | UptimeRobot a `/health` | Definido |
| **RNF-06** | Tolerancia a fallos | 0 reportes perdidos sin conexión | `apps/web` | Pruebas Playwright con corte de red | Definido |
| **RNF-07** | Recuperabilidad | 1 restauración probada por versión | PostgreSQL / PostGIS | Pipeline de GitHub Actions `pg_restore` | Definido |
| **RNF-08** | Ausencia de fallos | Tasa errores 5xx < 1 % | `apps/api` | Logs estructurados pino | Definido |
| **RNF-09** | Tiempo de respuesta | Latencia API p95 < 300 ms | Endpoints Fastify | Escenario de prueba en `k6` | Definido |
| **RNF-10** | Difusión de eventos | Difusión WebSocket p95 < 2 s | Socket.io | Prueba de carga con clientes Socket.io en k6 | Definido |
| **RNF-11** | Consulta espacial | Consulta espacial p95 < 100 ms | PostGIS (100k registros) | `EXPLAIN ANALYZE` en script de integración | Definido |
| **RNF-12** | Tamaño de bundle | JS inicial PWA < 250 KB | `apps/web` | Vite bundle analyzer / Lighthouse CI | Definido |
| **RNF-13** | Seguridad | 0 vulnerabilidades altas/críticas | Dependencias npm | `npm audit` y Dependabot en CI | Definido |
