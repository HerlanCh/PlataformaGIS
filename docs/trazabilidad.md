# Matriz de Trazabilidad de Requisitos

Esta matriz vincula requisito → historia → caso de prueba: los requisitos funcionales (RF) del [`srs.md`](srs.md), las historias de usuario (HU), los módulos y casos de uso que los implementan, y las pruebas asociadas. Se actualiza incrementalmente en cada fase del roadmap.

Los nombres de casos de uso provienen del roadmap; los marcados "por definir" se nombran en la fase que los implementa. `apps/web` es un adaptador de entrada, no un módulo: no contienen lógica de negocio.

---

## 1. Trazabilidad de Historias de Usuario (Funcional)

| Requisito | ID Historia | Nombre de la Historia | Módulo | Caso de Uso (`application/`) | Caso de Prueba | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| RF-01<br>RF-02<br>RF-03 | **HU-01** | Crear reporte en dos toques con ubicación automática | `identity`<br>`reports`<br>`verification` | `RegistrarDispositivo`<br>`CrearReporte`<br>`RegistrarConfirmacionPorDuplicado` | `HU-01: crea reporte activo con coordenadas válidas`<br>`HU-01: un duplicado se registra como confirmación`<br>`HU-01: rechaza coordenadas fuera del rectángulo`<br>`HU-01: un duplicado del propio autor no crea reporte ni voto`<br>`HU-01: rechaza al superar el límite de creación` | Casos de uso probados (Fase 5) |
| RF-04<br>RF-05<br>RF-06 | **HU-02** | Ver reportes activos en mapa en tiempo real | `reports` | `ListarReportesEnVentana` | `HU-02: filtra por viewport y estados vigentes`<br>`HU-02: difunde el reporte a los clientes de su celda`<br>`HU-02: usa el centro de la celda en categoría sensible`<br>`HU-02: la respuesta no contiene location ni author_id` | Casos de uso probados (Fase 5); difusión en la Fase 7 |
| RF-07<br>RF-08 | **HU-03** | Confirmar o negar un reporte ("¿Sigue ahí?") | `verification`<br>`reports` | `ConfirmarReporte`<br>`NegarReporte`<br>`AplicarDecisionDeVerificacion`<br>`AjustarReputacionPorDesenlace` | `HU-03: confirma al alcanzar el umbral ponderado y extiende la vigencia`<br>`HU-03: resuelve al acumular negaciones`<br>`HU-03: el autor no puede votar su propio reporte`<br>`HU-03: un solo votante no confirma`<br>`HU-03: rechaza un voto repetido`<br>`HU-03: rechaza el voto de un usuario lejano`<br>`HU-03: aplica la segunda extensión y ninguna más` | Casos de uso probados (Fase 5) |
| RF-09 | **HU-04** | Caducidad automática por categoría | `reports` | `CaducarReportes` | `HU-04: pasa a CADUCADO al vencer el TTL`<br>`HU-04: no caduca antes de expires_at`<br>`HU-04: un reporte CONFIRMADO vencido también caduca` | Casos de uso probados (Fase 5) |
| RF-10 | **HU-05** | Reportar sin conexión y enviar al reconectar | `reports` | `CrearReporte` (idempotente) | `HU-05: guarda el reporte en la cola local sin conexión`<br>`HU-05: envía la cola al reconectar`<br>`HU-05: procesa una solicitud repetida exactamente una vez` | Reenvío idempotente probado (Fase 5); cola local en la Fase 8 |
| RF-11 | **HU-06** | Mapa de calor espacial agregado | `heatmap` | `ObtenerMapaDeCalor` | `HU-06: descarta celdas con menos de 3 reportes`<br>`HU-06: incluye celdas con 3 o más reportes` | Casos de uso probados (Fase 5) |
| RF-12 | **HU-07** | Suscripción a zonas de interés | `subscriptions` | `SuscribirZona`<br>`EliminarZona` | `HU-07: guarda una zona válida`<br>`HU-07: rechaza un radio fuera de rango`<br>`HU-07: rechaza al superar el límite de zonas`<br>`HU-07: elimina una zona` | Casos de uso probados (Fase 5) |
| RF-13 | **HU-08** | Notificaciones de incidentes cercanos | `subscriptions`<br>`notifications` | `NotificarSuscriptores` | `HU-08: notifica a los suscriptores de la zona y categoría`<br>`HU-08: no notifica fuera de la zona o de la categoría`<br>`HU-08: notifica una sola vez por reporte`<br>`HU-08: no notifica al autor` | Casos de uso probados (Fase 5); envío por Web Push en la Fase 8 |
| RF-01<br>RF-14 | **HU-09** | Bot de Telegram para consulta y reporte | `identity`<br>`reports`<br>`verification`<br>`subscriptions` | `RegistrarDispositivo`<br>`CrearReporte`<br>`ConfirmarReporte` / `NegarReporte`<br>`SuscribirZona` | `HU-09: /start vincula la cuenta de Telegram`<br>`HU-09: /reportar crea un reporte con la ubicación compartida`<br>`HU-09: /cerca lista los reportes a 1 km`<br>`HU-09: /zona crea una zona suscrita` | Descartada (ADR-004) |
| RF-15 | **HU-10** | Clasificación automática de reportes sospechosos | `classifier`<br>`reports` | `ClasificarReporte`<br>`AgregarDescripcion` | `HU-10: marca un reporte con indicios de spam cuando el autor lo describe`<br>`HU-10: crear un reporte no depende del clasificador y se clasifica con las reglas locales`<br>`HU-10: con el servicio de IA caído clasifica con las reglas locales` | Clasificador por reglas (Fase 10) |
| RF-16 | **HU-11** | Datos abiertos anonimizados | `open-data` | Por definir (Fase 10) | `HU-11: exporta sin usuarios ni puntos exactos`<br>`HU-11: declara la licencia de los datos` | Especificado (Fase 0) |
| RF-08<br>RF-17 | **HU-12** | Moderación y auditoría de incidentes | `moderation`<br>`verification`<br>`identity` | `RechazarReporte`<br>`MantenerReporte`<br>`ListarColaDeModeracion`<br>`ActualizarColaDeModeracion`<br>`AplicarRechazoDeModeracion`<br>`AjustarReputacionPorDesenlace`<br>`AscenderAModerador` | `HU-12: rechaza con motivo, audita y penaliza al autor`<br>`HU-12: deniega la acción sin rol MODERADOR`<br>`HU-10 y HU-12: un reporte con enlace aparece marcado en la cola y el moderador lo rechaza`<br>`HU-12: rechazar exige un motivo y ofrece el de la regla ética` | Moderación operativa (Fase 10) |

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
| **RNF-09** | Tiempo de respuesta | Latencia API p95 < 300 ms | Endpoints Fastify | Escenario de prueba en `k6` | Verificado en staging (Fase 6) |
| **RNF-10** | Difusión de eventos | Difusión WebSocket p95 < 2 s | Socket.io | `pnpm carga:difusion` con 500 clientes | Verificado en staging (Fase 7) |
| **RNF-11** | Consulta espacial | Consulta espacial p95 < 100 ms | PostGIS (100k registros) | `EXPLAIN ANALYZE` con la carga sintética | Definido |
| **RNF-12** | Tamaño de bundle | JS inicial PWA < 250 KB | `apps/web` | Lighthouse CI | Definido |
| **RNF-13** | Seguridad | 0 vulnerabilidades altas/críticas | Dependencias y API | `npm audit`, Dependabot, OWASP ZAP | Verificado en CI (Fase 1) |
| **RNF-14** | Privacidad | 0 respuestas públicas con `location` o `author_id` | `apps/api`, Socket.io, datos abiertos | Prueba de privacidad sobre todas las rutas | Verificado en la API REST (Fase 6) |

---

## 3. Fase 2: modelo de dominio

Reglas de negocio ya implementadas y probadas en `domain/`. Las pruebas viven en `tests/` de cada módulo (o junto al código en los paquetes compartidos) y llevan el ID de la historia en el nombre.

### 3.1 Reglas de negocio por historia

| Historia | Regla (SRS) | Implementación | Archivo de pruebas |
| :--- | :--- | :--- | :--- |
| HU-01 | Solo se aceptan ubicaciones dentro del área de servicio (1.3) | `PuntoGeo` en `shared-kernel` | `packages/shared-kernel/src/geo-point.test.ts` |
| HU-01 | Un reporte nace `ACTIVO` con la caducidad de su categoría (3.1) | `Reporte.crear`, `Categoria`, `PoliticaDeCaducidad` | `packages/modules/reports/tests/report.test.ts` |
| HU-01, HU-09 | Registro anónimo por dispositivo y vínculo con Telegram | `Usuario` | `packages/modules/identity/tests/user.test.ts` |
| HU-02 | En categorías sensibles se muestra el centro de la celda de 200 m (3.1) | `PoliticaDePrivacidad`, `utm19s` | `packages/modules/reports/tests/privacy-policy.test.ts`, `utm19s.test.ts` |
| HU-02 | Los eventos públicos no llevan ubicación real ni usuarios (RNF-14) | Audiencia de cada evento en `contracts` | `packages/contracts/src/events.test.ts` |
| HU-03 | Reglas para emitir un voto: autor, voto único, 1000 m, reporte vigente (3.2.2) | `Vote.cast` | `packages/modules/verification/tests/vote.test.ts` |
| HU-03 | Confirmar, extender y resolver por votos ponderados y votantes distintos (3.2.3 a 3.2.5) | `PoliticaDeVerificacion` | `packages/modules/verification/tests/verification-policy.test.ts` |
| HU-03 | Máquina de estados y extensiones de vigencia, máximo 2 (3.2.4) | `Reporte` | `packages/modules/reports/tests/report.test.ts` |
| HU-03, HU-12 | Ajustes de reputación, silenciado y recuperación (3.2.6 y 3.2.7) | `Reputacion`, `PoliticaDeReputacion` | `packages/modules/verification/tests/reputation.test.ts` |
| HU-04 | Caducidad al vencer el TTL, nunca antes; también en `CONFIRMADO` | `Reporte.caducar`, `PoliticaDeCaducidad` | `packages/modules/reports/tests/report.test.ts`, `expiration-policy.test.ts` |
| HU-12 | Rechazo con motivo; el rechazo por autor silenciado no penaliza | `Reporte.rechazar`, `PoliticaDeReputacion` | `report.test.ts`, `reputation.test.ts` |

Quedan para la Fase 5, porque dependen de casos de uso: deduplicación (HU-01), límites de creación y de votos (HU-01), consulta por viewport (HU-02) e idempotencia (HU-05).

### 3.2 Puertos

| Módulo | Puerto | Propósito | Se implementa en |
| :--- | :--- | :--- | :--- |
| `identity` | `RepositorioDeUsuarios` | Buscar y guardar usuarios | Fase 3 |
| `reports` | `RepositorioDeReportes` | Guardar y recuperar reportes | Fase 3 (consultas espaciales: Fase 4) |
| `reports` | `RepositorioDeCategorias` | Leer categorías | Fase 3 |
| `reports` | `GeneradorDeId` | Generar identificadores | Fase 5 |
| `reports` | `ReputacionDelAutor` | Saber si el autor está silenciado | Fase 5 (conectado a `verification` en la raíz de composición) |
| `verification` | `RepositorioDeVotos` | Guardar y leer votos | Fase 3 |
| `verification` | `RepositorioDeReputaciones` | Guardar y leer reputaciones | Fase 3 |
| `verification` | `ConsultaDeReporte` | Autor, estado, ubicación y extensiones de un reporte | Fase 5 (conectado a `reports` en la raíz de composición) |
| `shared-kernel` | `Reloj` | Fecha y hora actuales | Fase 5 |

### 3.3 Eventos de integración

Definidos en `packages/contracts/src/events.ts`. Un evento público puede difundirse a los clientes; uno interno solo circula entre módulos del servidor.

| Evento | Audiencia | Emite | Escucha |
| :--- | :--- | :--- | :--- |
| `ReporteCreado.v1` | Pública | `reports` | `subscriptions`, clientes |
| `ReporteConfirmado.v1` | Pública | `reports` | `verification`, clientes |
| `ReporteExtendido.v1` (Fase 5) | Pública | `reports` | clientes |
| `ReporteResuelto.v1` | Pública | `reports` | `verification`, clientes |
| `ReporteCaducado.v1` | Pública | `reports` | clientes |
| `ReporteRechazado.v1` | Pública | `reports` | `verification`, clientes |
| `ReporteDuplicadoDetectado.v1` | Interna | `reports` | `verification` |
| `VotoEmitido.v1` | Interna | `verification` | `reports` |
| `RechazoDeModeracion.v1` (Fase 5) | Interna | `moderation` | `reports` |

En la Fase 5, `NotificarSuscriptores` quedó en `subscriptions` (dueño de las zonas) y solo escucha `ReporteCreado.v1`: la confirmación no vuelve a avisar (HU-08, escenario 3).

## 4. Fase 3: persistencia

Esquema físico y adaptadores que implementan los puertos de la Fase 2. El detalle de tablas y columnas está en [`diccionario-datos.md`](diccionario-datos.md) y el diagrama en [`modelo-datos.puml`](modelo-datos.puml). Las tablas y columnas se llaman en español; el código conserva sus nombres en inglés. Todas las pruebas de esta sección son de integración y corren contra PostGIS real con Testcontainers.

### 4.1 Puertos implementados

| Módulo | Puerto | Adaptador | Tablas | Archivo de pruebas |
| :--- | :--- | :--- | :--- | :--- |
| `identity` | `RepositorioDeUsuarios` | `RepositorioUsuariosPg` | `usuarios` | `packages/modules/identity/tests/user-repository.integration.test.ts` |
| `reports` | `RepositorioDeReportes` | `RepositorioReportesPostgis` | `reportes` | `packages/modules/reports/tests/persistence.integration.test.ts` |
| `reports` | `RepositorioDeCategorias` | `RepositorioCategoriasPg` | `categorias` | `packages/modules/reports/tests/persistence.integration.test.ts` |
| `reports` | `UnidadDeTrabajoDeReporte` | `UnidadDeTrabajoReportePg` | `reportes`, `eventos_salida` | `packages/modules/reports/tests/persistence.integration.test.ts` |
| `verification` | `RepositorioDeVotos` | `RepositorioVotosPg` | `votos` | `packages/modules/verification/tests/persistence.integration.test.ts` |
| `verification` | `RepositorioDeReputaciones` | `RepositorioReputacionesPg` | `reputaciones` | `packages/modules/verification/tests/persistence.integration.test.ts` |
| `subscriptions` | `RepositorioDeSuscripciones` | `RepositorioSuscripcionesPg` | `zonas_suscritas` | `packages/modules/subscriptions/tests/persistence.integration.test.ts` |

`acciones_moderacion` solo tiene tabla en esta fase; la prueba `packages/modules/moderation/tests/migrations.integration.test.ts` cubre sus restricciones.

### 4.2 Requisitos garantizados por la base de datos

| Requisito | Garantía | Mecanismo | Archivo de pruebas |
| :--- | :--- | :--- | :--- |
| HU-03 | Un solo voto por usuario y reporte, también si llegan dos a la vez | Clave primaria (`id_reporte`, `id_usuario`) en `votos`; el adaptador la traduce a `ErrorYaVoto` | `verification/tests/persistence.integration.test.ts` |
| HU-03, HU-12 | La reputación y el peso de un voto están entre 0 y 5 | `CHECK` en `reputaciones.puntaje` y `votos.peso` | `verification/tests/persistence.integration.test.ts` |
| HU-03, HU-04 | Un reporte solo puede estar en uno de los cinco estados y usar hasta 2 extensiones | `CHECK` en `reportes.estado` y `reportes.extensiones` | `reports/tests/persistence.integration.test.ts` |
| HU-05 | Una clave de idempotencia no se repite | Índice único en `reportes.clave_idempotencia`; el dominio valida su formato | `reports/tests/persistence.integration.test.ts`, `idempotency-key.test.ts` |
| HU-07 | El radio de una zona está entre 100 m y 2000 m y la zona tiene al menos una categoría | `ZonaSuscrita` en el dominio y `CHECK` en `zonas_suscritas` | `subscriptions/tests/zone-subscription.test.ts`, `persistence.integration.test.ts` |
| HU-12 | Todo rechazo de moderación lleva su motivo | `CHECK` en `acciones_moderacion` | `moderation/tests/migrations.integration.test.ts` |
| RNF-14 | La ubicación real y la pública se guardan por separado; la pública es la que decidió el dominio | Columnas `ubicacion` y `ubicacion_publica`; el repositorio no la recalcula | `reports/tests/persistence.integration.test.ts` |
| Atomicidad | Si falla la escritura del evento, el reporte tampoco se guarda | `UnidadDeTrabajoReportePg`: una sola transacción con el outbox | `reports/tests/persistence.integration.test.ts` |
| ADR-001 | Un módulo apagado no crea sus tablas y el resto del esquema queda completo | Un historial de migraciones por módulo | `apps/api/src/migrations.integration.test.ts` |
| ADR-001 | Sin claves foráneas entre módulos | Solo existe `reportes.codigo_categoria → categorias.codigo`, dentro de `reports` | Revisión de las migraciones |

### 4.3 Migraciones

Cada conjunto (plataforma y cada módulo) se aplica sobre una base vacía, se revierte y se vuelve a aplicar en su prueba de integración. `apps/api/src/migrations.integration.test.ts` aplica el esquema completo desde cero en cada ejecución de la CI.

## 5. Fase 4: consultas espaciales

Consultas espaciales sobre PostGIS, con sus índices y su medición con 100.000 reportes. Los planes de ejecución y los tiempos están en [`rendimiento/consultas-espaciales.md`](rendimiento/consultas-espaciales.md), que genera `pnpm perf:espacial`.

### 5.1 Consultas implementadas

| Requisito | Consulta | Puerto → adaptador | Índice que usa | Archivo de pruebas |
| :--- | :--- | :--- | :--- | :--- |
| HU-02 | Reportes de la ventana del mapa, por categoría y estado, con tope de filas | `RepositorioDeReportes.buscarEnVentana` → `RepositorioReportesPostgis` | `reportes_ubicacion_publica_idx`; `reportes_creado_en_idx` si la ventana abarca casi toda la ciudad | `reports/tests/consultas-espaciales.integration.test.ts` |
| Sin historia todavía | Reportes vigentes a una distancia de un punto (ubicación real, uso interno). La pide el roadmap; ningún caso de uso la consume aún | `RepositorioDeReportes.buscarCercanos` → `RepositorioReportesPostgis` | `reportes_ubicacion_geography_idx`, `reportes_vigentes_idx` | `reports/tests/consultas-espaciales.integration.test.ts` |
| HU-01 | Duplicado: misma categoría, vigente y dentro de su radio | `RepositorioDeReportes.buscarDuplicado` → `RepositorioReportesPostgis` | `reportes_ubicacion_geography_idx`, `reportes_vigentes_idx` | `reports/tests/consultas-espaciales.integration.test.ts` |
| HU-04 | Reportes vigentes con la caducidad vencida, en lotes | `RepositorioDeReportes.buscarCaducados` → `RepositorioReportesPostgis` | `reportes_vigentes_idx` | `reports/tests/consultas-espaciales.integration.test.ts` |
| HU-06 | Mapa de calor por celdas, con umbral de 3 reportes | `ConsultaDeMapaDeCalor.agregar` → `ConsultaMapaCalorPg` | `reportes_ubicacion_publica_idx`, `reportes_creado_en_idx` | `heatmap/tests/consulta-mapa-calor.integration.test.ts`, `consulta-de-calor.test.ts`, `apps/api/src/mapa-calor.integration.test.ts` |
| HU-08 | Zonas suscritas que contienen un punto, por categoría | `RepositorioDeSuscripciones.buscarSuscriptores` → `RepositorioSuscripcionesPg` | `zonas_suscritas_centro_idx` | `subscriptions/tests/suscriptores.integration.test.ts` |
| HU-02 | Celda geohash de un punto y celdas que cubren una ventana (para la Fase 7) | `celdaDe`, `celdasQueCubren` en `shared-kernel` | No aplica (función pura) | `packages/shared-kernel/src/geohash.test.ts` |

### 5.2 Requisitos garantizados

| Requisito | Garantía | Mecanismo | Archivo de pruebas |
| :--- | :--- | :--- | :--- |
| RNF-14 | La consulta por ventana solo devuelve la ubicación pública, nunca la real ni el autor, y exige indicar los estados | Proyección `ReportePublico`; el filtro espacial usa `ubicacion_publica`; sin estados lanza un error en lugar de incluir los rechazados | `reports/tests/consultas-espaciales.integration.test.ts` |
| HU-06 | Una celda con menos de 3 reportes no se publica | `HAVING count(*) >= 3` en la consulta; celda mínima de 100 m validada en el dominio | `heatmap/tests/consulta-mapa-calor.integration.test.ts` |
| HU-06 | Mover la ventana no cambia las celdas ni sus conteos, así que no sirve para aislar un reporte | Cuadrícula fija para toda la ciudad (`cuadriculaPara`) y ventana ampliada a celdas enteras | `heatmap/tests/consulta-mapa-calor.integration.test.ts`, `consulta-de-calor.test.ts` |
| Eficiencia | Cada consulta, también en su peor caso, usa un índice y su p95 es menor a 100 ms con 100.000 reportes | `pnpm seed:load` y `pnpm perf:espacial`, que falla si no se cumple | `docs/rendimiento/consultas-espaciales.md` |
| ADR-003 | `heatmap` lee `reportes` sin importar código de `reports`, y un cambio de esquema en `reports` se detecta | Solo `SELECT` de columnas públicas; `dependency-cruiser` sin violaciones; prueba con las migraciones reales | `pnpm depcruise`, `apps/api/src/mapa-calor.integration.test.ts` |

---

## 6. Fase 5: casos de uso

Cada caso de uso es una clase de `application/` con `ejecutar(entrada)`; cada manejador de eventos, una clase con `manejar(evento)`. Las pruebas usan dobles en memoria (`tests/dobles.ts` de cada módulo y `@gis/testing`: `RelojFijo`, `GeneradorDeIdSecuencial`, `LimitadorEnMemoria`). Los nombres de las pruebas llevan el ID de la historia.

### 6.1 Escenarios de aceptación

| Historia | Escenario | Caso de uso o manejador | Archivo de pruebas |
| :--- | :--- | :--- | :--- |
| HU-01 | 1. Creación dentro del área: `ACTIVO`, caducidad de la categoría y `ReporteCreado.v1` | `CrearReporte` | `reports/tests/crear-reporte.test.ts` |
| HU-01 | 2. Deduplicación: el envío cuenta como confirmación del existente | `CrearReporte` → `ReporteDuplicadoDetectado.v1` → `RegistrarConfirmacionPorDuplicado` | `reports/tests/crear-reporte.test.ts`, `verification/tests/casos-de-uso.test.ts`, `apps/api/src/casos-de-uso.integration.test.ts` |
| HU-01 | 3. Fuera de La Paz y El Alto se rechaza | `CrearReporte` | `reports/tests/crear-reporte.test.ts` |
| HU-01 | 4. Duplicado del propio reporte: ni reporte nuevo ni voto | `CrearReporte` | `reports/tests/crear-reporte.test.ts` |
| HU-01 | 5. Sexto reporte en 10 minutos: se indica cuánto esperar | `CrearReporte` con `LimitadorDeFrecuencia` | `reports/tests/crear-reporte.test.ts` |
| HU-02 | 1. Solo `ACTIVO` y `CONFIRMADO` dentro de la ventana (y no vencidos) | `ListarReportesEnVentana` | `reports/tests/casos-de-uso.test.ts` |
| HU-02 | 3. Robo en el centro de su celda de 200 m | `ListarReportesEnVentana`, `CrearReporte` | `reports/tests/casos-de-uso.test.ts`, `crear-reporte.test.ts` |
| HU-02 | 4. Sin `location` ni `author_id` en la respuesta ni en el evento | `ListarReportesEnVentana`, `CrearReporte` | `reports/tests/casos-de-uso.test.ts`, `crear-reporte.test.ts` |
| HU-03 | 1. La confirmación que llega a 3,0 con 2 votantes confirma y extiende 90 min | `ConfirmarReporte` → `VotoEmitido.v1` → `AplicarDecisionDeVerificacion` | `verification/tests/casos-de-uso.test.ts`, `reports/tests/casos-de-uso.test.ts`, `apps/api/src/casos-de-uso.integration.test.ts` |
| HU-03 | 2. Las negaciones que llegan a 3,0 resuelven el reporte | `NegarReporte` → `AplicarDecisionDeVerificacion` | `verification/tests/casos-de-uso.test.ts`, `reports/tests/casos-de-uso.test.ts` |
| HU-03 | 3. El autor no puede votar | `ConfirmarReporte` | `verification/tests/casos-de-uso.test.ts` |
| HU-03 | 4. Un solo votante no basta | `ConfirmarReporte` | `verification/tests/casos-de-uso.test.ts` |
| HU-03 | 5. Voto repetido | `ConfirmarReporte`, `NegarReporte` | `verification/tests/casos-de-uso.test.ts` |
| HU-03 | 6. Votante a más de 1000 m | `ConfirmarReporte` | `verification/tests/casos-de-uso.test.ts` |
| HU-03 | 7. Segunda extensión a 6,0 y ninguna más | `ConfirmarReporte` → `AplicarDecisionDeVerificacion` | `verification/tests/casos-de-uso.test.ts`, `reports/tests/casos-de-uso.test.ts` |
| HU-04 | 1 a 3. Caduca a los 181 min, no a los 179; también un `CONFIRMADO` vencido | `CaducarReportes` | `reports/tests/casos-de-uso.test.ts` |
| HU-05 | 3. El reenvío con la misma clave devuelve el resultado original, también si dos envíos llegan a la vez | `CrearReporte`, `UnidadDeTrabajoReportePg` | `reports/tests/crear-reporte.test.ts`, `reports/tests/persistence.integration.test.ts` |
| HU-06 | 1 y 2. Celda con 2 reportes oculta; con 3, visible con su conteo | `ObtenerMapaDeCalor` | `heatmap/tests/obtener-mapa-de-calor.test.ts` |
| HU-07 | 1 a 4. Alta con radio de 800 m, radio de 2500 m rechazado, límite de 5 zonas y baja | `SuscribirZona`, `EliminarZona` | `subscriptions/tests/casos-de-uso.test.ts` |
| HU-08 | 1 a 4. Aviso dentro de zona y categoría, nada fuera, un solo aviso por reporte, nunca al autor | `NotificarSuscriptores` | `subscriptions/tests/casos-de-uso.test.ts`, `apps/api/src/casos-de-uso.integration.test.ts` |
| HU-12 | 1. Rechazo con motivo: auditoría, `RECHAZADO`, `ReporteRechazado.v1` y −0,50 al autor | `RechazarReporte` → `RechazoDeModeracion.v1` → `AplicarRechazoDeModeracion` → `AjustarReputacionPorDesenlace` | `moderation/tests/rechazar-reporte.test.ts`, `reports/tests/casos-de-uso.test.ts`, `verification/tests/casos-de-uso.test.ts`, `apps/api/src/casos-de-uso.integration.test.ts` |
| HU-12 | 2. Sin rol `MODERADOR` se deniega | `RechazarReporte` | `moderation/tests/rechazar-reporte.test.ts` |

Quedan para otras fases: HU-02 escenario 2 (difusión por WebSocket, Fase 7), HU-05 escenarios 1 y 2 (cola local de la PWA, Fase 8), HU-09 (descartada por ADR-004), HU-10 y HU-11 (Fase 10) y HU-12 escenario 3 (criterio del moderador, no automatizable).

### 6.2 Otras reglas cubiertas por los casos de uso

| Regla | Implementación | Archivo de pruebas |
| :--- | :--- | :--- |
| RF-01: un dispositivo obtiene un usuario anónimo y el mismo dispositivo lo recupera | `RegistrarDispositivo` | `identity/tests/registrar-dispositivo.test.ts` |
| SRS 3.2.6: reputación por el desenlace real (+0,20 al autor, +0,05 a votos acertados, −0,50 por rechazo) | `AjustarReputacionPorDesenlace` | `verification/tests/casos-de-uso.test.ts`, `apps/api/src/casos-de-uso.integration.test.ts` |
| SRS 3.2.7: el reporte de un silenciado se guarda `RECHAZADO` sin eventos ni aviso; su voto pesa 0; se recupera a los 30 días | `CrearReporte`, `ConfirmarReporte` | `reports/tests/crear-reporte.test.ts`, `verification/tests/casos-de-uso.test.ts` |
| SRS 3.3: 30 votos cada 10 minutos por usuario | `VotarReporte` con `LimitadorDeFrecuencia` | `verification/tests/casos-de-uso.test.ts` |
| Atomicidad: voto, reputación y evento se guardan juntos; auditoría y evento, también | `UnidadDeTrabajoVotoPg`, `UnidadDeTrabajoModeracionPg` | `verification/tests/persistence.integration.test.ts`, `moderation/tests/unidad-de-trabajo.integration.test.ts` |
| Errores tipados que traducirán los adaptadores (404, 403, 409, 422, 429) | `ErrorDeAplicacion` y `aErrorDeAplicacion` en `shared-kernel` | `packages/shared-kernel/src/error-de-aplicacion.test.ts` |
| ADR-001: los módulos solo se conocen por eventos y por puertos que conecta la raíz de composición | `apps/api/src/composicion/puentes.ts` | `apps/api/src/casos-de-uso.integration.test.ts`, `pnpm depcruise` |

### 6.3 Puertos nuevos

| Módulo | Puerto | Propósito | Adaptador |
| :--- | :--- | :--- | :--- |
| `shared-kernel` | `LimitadorDeFrecuencia` | Límite de operaciones por usuario y ventana | En memoria para pruebas; `@fastify/rate-limit` en la Fase 6 |
| `shared-kernel` | `GeneradorDeId` | Identificadores (antes en `reports`) | Raíz de composición (Fase 6) |
| `verification` | `UnidadDeTrabajoDeVoto` | Voto, reputación y evento en una transacción | `UnidadDeTrabajoVotoPg` |
| `subscriptions` | `ConsultaDeAutor` | Autor de un reporte, para no avisarle | `consultaDeAutor` en `apps/api/src/composicion/puentes.ts` |
| `subscriptions` | `EnviadorDeNotificaciones` | Canal de los avisos | Registro en log en la Fase 7; Web Push en la Fase 8 (Telegram descartado por ADR-004) |
| `moderation` | `ConsultaDeReporte` | Estado de un reporte | `consultaParaModeracion` en `puentes.ts` |
| `moderation` | `UnidadDeTrabajoDeModeracion` | Auditoría y evento en una transacción | `UnidadDeTrabajoModeracionPg` |

---

## 7. Fase 6: API REST y seguridad

Adaptador HTTP en `apps/api/src/http/`. Los esquemas de cada ruta están en `packages/contracts/src/http.ts` y generan el documento OpenAPI (`/docs`, `/docs/json`) y el cliente `@gis/api-client`. Las pruebas de extremo a extremo están en `apps/api/src/http/api.integration.test.ts` (PostGIS con Testcontainers).

### 7.1 Rutas

| Ruta | Caso de uso | Historia | Pruebas |
| :--- | :--- | :--- | :--- |
| `POST /v1/dispositivos` | `RegistrarDispositivo` y emisión del JWT | RF-01 | registro, repetición, hash inválido |
| `POST /v1/reportes` | `CrearReporte` | HU-01, HU-05 | 201, duplicado (200), `Idempotency-Key` ausente (400), reenvío, fuera del área (422), sexto reporte (429) |
| `GET /v1/reportes` | `ListarReportesEnVentana` | HU-02 | ventana válida, `bbox` mal escrito (400) |
| `POST /v1/reportes/:id/confirmar` y `/negar` | `ConfirmarReporte`, `NegarReporte` | HU-03 | voto válido, autor (403), repetido (409), reporte inexistente (404) |
| `GET /v1/mapa-calor` | `ObtenerMapaDeCalor` | HU-06 | celdas, rango de más de 90 días (422) |
| `POST /v1/suscripciones`, `DELETE /v1/suscripciones/:id` | `SuscribirZona`, `EliminarZona` | HU-07 | alta (201), baja (204), zona ajena (403) |
| `POST /v1/moderacion/reportes/:id/rechazar` | `RechazarReporte` | HU-12 | ciudadano (403), moderador (202) |
| `POST /v1/moderacion/reportes/:id/mantener` | `MantenerReporte` | HU-12 | moderador (204) |
| `GET /v1/moderacion/cola` | `ListarColaDeModeracion` | HU-10, HU-12 | ciudadano (403), moderador (200) |
| `PATCH /v1/reportes/:id/descripcion` | `AgregarDescripcion` | HU-10 | otro usuario (403), autor (204), repetida (409) |

### 7.2 Requisitos no funcionales

| Requisito | Garantía | Mecanismo | Pruebas |
| :--- | :--- | :--- | :--- |
| RNF-14 | Ninguna respuesta lleva la ubicación real ni el autor | Las respuestas se serializan con el esquema de salida; una prueba recorre todas las respuestas | `api.integration.test.ts` ("RNF-14") |
| Contrato | Cada respuesta exitosa cumple su esquema OpenAPI | Ajv 2020 contra `app.swagger()` | `api.integration.test.ts` ("contrato") |
| Contrato | El cliente nunca queda desfasado de la API | `pnpm gen:api`; una prueba compara el documento guardado con el generado | `apps/api/src/http/http.test.ts` |
| RNF-13 | Autenticación: sin token, token alterado, vencido o de otra clave → 401; rol insuficiente → 403 | `ServicioDeTokens` (HS256 con `jose`), `exigirToken` | `http.test.ts`, `api.integration.test.ts` |
| RNF-13 | Rotación de la clave sin cortar sesiones | `JWT_SECRET_ANTERIOR` también verifica | `api.integration.test.ts` ("rotación") |
| RNF-13 | Cabeceras seguras y CORS solo para la PWA | `@fastify/helmet`, `@fastify/cors` | `api.integration.test.ts` ("protecciones") |
| RNF-13 | Límite por IP y por usuario; cuerpo de hasta 16 KB | `@fastify/rate-limit`, `LimitadorDeFrecuenciaEnProceso`, `bodyLimit` | `api.integration.test.ts`, `composicion.test.ts` |
| RNF-13 | 0 hallazgos altos en OWASP ZAP | Flujo `.github/workflows/zap.yml` contra staging | Ejecución `39071261409` (0 altos), `docs/rendimiento/api-staging.md` |
| RNF-09 | p95 < 300 ms en staging | Escenario `tools/carga/api-basica.js` (k6) | `docs/rendimiento/api-staging.md` (p95 de 245 ms) |
| Errores | Todo error sale en RFC 7807, sin detalles internos en los 500 | `registrarErrores`, `aProblema` | `http.test.ts`, `api.integration.test.ts` |
| Fiabilidad | Apagado ordenado con tiempo máximo | `crearApagado` | `composicion.test.ts` |
| ADR-001 | Un módulo opcional apagado no expone sus rutas | `componerCasosDeUso` devuelve `null` y la ruta no se registra | `api.integration.test.ts`, `composicion.test.ts` |

---

## 8. Fase 7: tiempo real y fiabilidad de eventos

Entrega de eventos en `packages/platform/src/despachador.ts` (`BusDeEventosConSalida`, `DespachadorDeSalida`). Reacciones entre módulos en `apps/api/src/composicion/manejadores.ts`. Tiempo real en `apps/api/src/tiempo-real/`.

| Requisito | Garantía | Mecanismo | Pruebas |
| :--- | :--- | :--- | :--- |
| HU-02 (escenario 2), RF-05 | Un cambio de reporte llega a los clientes que miran su celda, y solo a ellos | Salas `celda:<geohash>` de precisión 6 y 5; el publicador emite a la celda de la ubicación pública | `tiempo-real.integration.test.ts` ("solo al cliente que mira la celda A"), `tiempo-real.test.ts` |
| RNF-10 | Difusión p95 < 2 s con 500 clientes | Despachador cada 250 ms; entrega en paralelo por reporte | `pnpm carga:difusion` (local: p95 de 263 ms; staging: p95 de 524 ms, `docs/rendimiento/difusion-staging.md`) |
| Fiabilidad | 0 eventos perdidos al reiniciar | Outbox: lo guardado y no publicado lo entrega el próximo despachador | `despachador.integration.test.ts` ("fiabilidad") |
| Fiabilidad | Un manejador que falla se reintenta, con espera; los que ya terminaron no se repiten | `intentos`, `proximo_intento` y la bandeja `eventos_procesados` | `despachador.integration.test.ts` |
| Fiabilidad | Dos despachadores no entregan el mismo evento | `FOR UPDATE SKIP LOCKED` | `despachador.integration.test.ts` |
| Fiabilidad | Un cliente que se desconecta poco tiempo recibe lo perdido | `connectionStateRecovery` (2 min) | `tiempo-real.integration.test.ts` ("reconexión") |
| HU-04, RF-09 | La caducidad corre sola y su evento llega al mapa | `ProgramadorDeTareas` con `CaducarReportes` cada 60 s | `tiempo-real.integration.test.ts` ("HU-04"), `tiempo-real.test.ts` |
| HU-03 | Voto → confirmación → reputación con el despachador real | Manejadores suscritos con nombre estable | `tiempo-real.integration.test.ts` ("HU-03") |
| HU-08 | Los suscriptores reciben el aviso de un reporte nuevo | `NotificarSuscriptores` ← `ReporteCreado.v1`, con `EnviadorDeNotificacionesEnRegistro` | `tiempo-real.test.ts` |
| ADR-001 | Con `subscriptions` y `notifications` apagados, la difusión y los votos siguen funcionando | Suscripción condicionada por interruptor | `tiempo-real.integration.test.ts` (corre con los opcionales apagados), `tiempo-real.test.ts` |
| RNF-13 | Solo clientes con token reciben eventos; solo los eventos públicos salen | Handshake con `ServicioDeTokens`; `CLAVES_PUBLICAS` | `tiempo-real.integration.test.ts` ("conexión"), `tiempo-real.test.ts` |

---

## 9. Fase 8: frontend PWA

### 9.1 Entrega 8a

| Historia | Escenario | Implementación (`apps/web/src`) | Pruebas |
| :--- | :--- | :--- | :--- |
| RF-01 | Registro anónimo del dispositivo | `services/sesion.ts` | `services/servicios.test.ts` |
| HU-01 | 1. Reporte en dos toques con el GPS | `features/reporte/HojaDeCategorias.tsx`, `usarReportar.ts` | `App.test.tsx`, `features/interfaz.test.tsx` |
| HU-01 | 2 a 5. Duplicado, fuera del área, propio y límite: mensajes visibles | `features/reporte/mensajes.ts` | `features/interfaz.test.tsx`, `services/servicios.test.ts` |
| HU-02 | 1. Reportes vigentes de la ventana | `features/mapa/usarReportes.ts`, `Mapa.tsx` | `App.test.tsx` |
| HU-02 | 2. Actualización en vivo por celdas | `services/tiempo-real.ts`, `domain/reportes.ts` (`aplicarEvento`) | `features/tiempo-real.test.tsx`, `domain/dominio.test.ts` |
| HU-02 | 3 y 4. Solo la ubicación pública | El cliente solo recibe `publicLocation`, que garantiza la API (Fase 6) | `api.integration.test.ts` (RNF-14) |
| HU-05 | 1. Guardado local con su clave y aviso «pendiente de envío» | `services/cola.ts`, `features/cerca/PanelCerca.tsx` | `services/servicios.test.ts`, `App.test.tsx` |
| HU-05 | 2. Envío al reconectar (`online` o Background Sync) | `App.tsx`, `sw.ts` | `App.test.tsx` |
| HU-05 | 3. Reenvío idempotente, sin duplicados | `Idempotency-Key` = clave de la cola | `services/servicios.test.ts` |
| Accesibilidad | Sin infracciones de axe; botones de 48 px o más | `ui/`, `features/` | `features/interfaz.test.tsx` |
| Rendimiento | JS inicial < 250 KB comprimido | `vite build` | 157 KB (bitácora 8a) |

Las pruebas de extremo a extremo con Playwright contra staging y Lighthouse CI cierran la fase en la entrega 8c.

### 9.2 Entrega 8b

| Historia | Escenario | Implementación | Pruebas |
| :--- | :--- | :--- | :--- |
| HU-03 | Detalle con «Sigue ahí» / «Ya no está» y la posición del momento | `apps/web/src/features/votos/HojaDeDetalle.tsx`, `usarVotar.ts`, `services/votos.ts` | `features/interaccion.test.tsx`, `services/interaccion.test.ts` |
| HU-03 | 3, 5 y 6. Autor, voto repetido y votante lejano: mensaje de la regla | `features/votos/mensajes.ts`; memoria local de propios y votados (`services/memoria.ts`) | `features/interaccion.test.tsx`, `services/interaccion.test.ts` |
| HU-03 | 2. Un reporte resuelto o caducado deja el mapa y cierra su detalle | `domain/reportes.ts` (`aplicarEvento`), `HojaDeDetalle.tsx` | `features/interaccion.test.tsx`, `features/tiempo-real.test.tsx` |
| HU-03 | Aviso «¿Sigue ahí?» automático: app abierta, a menos de 150 m, una vez por reporte | `domain/cercania.ts`, `features/votos/usarSigueAhi.ts`, `AvisoSigueAhi.tsx` | `domain/interaccion.test.ts`, `features/interaccion.test.tsx` |
| HU-02 | Filtros por línea y por antigüedad (última hora, 3 h, hoy) | `domain/filtros.ts`, `features/filtros/HojaDeFiltros.tsx`, `ui/Encabezado.tsx` | `domain/interaccion.test.ts`, `features/interaccion.test.tsx` |
| HU-06 | 1 y 2. Capa de calor con las celdas de 3 o más reportes y el umbral explicado | `features/calor/` (`leaflet.heat` cargado bajo demanda), `features/mapa/capas.ts` | `features/interaccion.test.tsx`, `features/mapa/capas.test.tsx` |
| HU-07 | Listar las zonas propias | `GET /v1/suscripciones` (`ListarZonas`, módulo `subscriptions`) | `packages/modules/subscriptions/tests/casos-de-uso.test.ts`, `api.integration.test.ts` |
| HU-07 | Crear con centro, radio (100–2000 m) y líneas; eliminar; límite de 5 | `features/zonas/` (mira fija y control deslizante), `services/zonas.ts` | `features/interaccion.test.tsx`, `services/interaccion.test.ts`, `features/mapa/capas.test.tsx` |
| Accesibilidad | Sin infracciones de axe en las hojas y el editor nuevos | `ui/Hoja.tsx`, `ui/Segmentado.tsx`, `features/` | `features/interaccion.test.tsx` |
| Rendimiento | JS inicial < 250 KB comprimido | `vite build`; `leaflet.heat` en un chunk aparte | 166 KB (bitácora 8b) |

### 9.3 Entrega 8c

| Historia | Escenario | Implementación | Pruebas |
| :--- | :--- | :--- | :--- |
| HU-08 | 1. Aviso con la categoría y la `public_location` a cada dispositivo del suscriptor | Módulo `notifications` (`EnviarAvisoPush`, `EmisorWebPush`), puente `EnviadorDeNotificacionesPush` en `apps/api/src/composicion/manejadores.ts` | `packages/modules/notifications/tests/casos-de-uso.test.ts`, `apps/api/src/http/avisos.test.ts` |
| HU-08 | 2 a 4. Fuera de la zona o la categoría, una vez por reporte, nunca al autor | `NotificarSuscriptores` (`subscriptions`, Fase 5); el canal push solo entrega | `packages/modules/subscriptions/tests/casos-de-uso.test.ts` |
| HU-08 | Alta y baja del dispositivo; suscripción vencida (404/410) borrada | `RegistrarSuscripcionPush`, `EliminarSuscripcionPush`, rutas `/v1/notificaciones/*` | `persistencia.integration.test.ts`, `avisos.test.ts`, `e2e/historias.spec.ts` |
| HU-08 | Activar los avisos en la PWA; el aviso abre el reporte | `apps/web/src/services/push.ts`, `features/avisos/`, `sw.ts`, `services/aviso.ts` | `features/avisos.test.tsx`, `e2e/historias.spec.ts` |
| Instalación | Instalable (manifiesto, iconos PNG, service worker) y ayuda para iPhone y Android | `vite.config.ts`, `public/*.png`, `features/instalar/` | `e2e/historias.spec.ts`, `features/avisos.test.tsx` |
| HU-01, 02, 03, 05, 06, 07 | De extremo a extremo con una API real | La PWA completa | `apps/web/e2e/historias.spec.ts` (Playwright; en staging tras cada Release) |
| HU-04 | Caducidad automática | Verificada en staging en la Fase 7 | Bitácora de la Fase 7 |
| Accesibilidad | axe-core en el navegador real, en la pantalla y en cada hoja; Lighthouse ≥ 90 | `ui/`, `features/` | `e2e/historias.spec.ts`, Lighthouse CI (100) |
| Rendimiento | JS inicial < 250 KB comprimido; Performance ≥ 90 | Teselas iniciales precargadas; `leaflet.heat` aparte | `tools/presupuesto/js-inicial.mjs` (164 KB), Lighthouse CI (93) |

**Cierre en staging (v2.7.1):** la corrida de `e2e.yml` contra staging aprobó las 8 pruebas de `apps/web/e2e/historias.spec.ts` (HU-01, 02, 03, 05, 06, 07 y 08, la instalabilidad y la accesibilidad). Con eso se marcan los criterios de salida de la Fase 8 en el roadmap.
