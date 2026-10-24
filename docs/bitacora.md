# Bitácora de Desarrollo del Proyecto

Registro cronológico de decisiones, avances por fase, cambios arquitectónicos y reflexiones técnicas para la Plataforma GIS de alerta temprana.

---

## [2026-10-11] — Cierre de Fase 0: Gobernanza y Requisitos

### Objetivo de la Fase
Establecer la base normativa, de calidad y de especificación formal previa a la escritura de código, cumpliendo los procesos de definición de necesidades y requisitos de **ISO/IEC/IEEE 12207** y fijando las metas del modelo de calidad **ISO/IEC 25010**.

### Artefactos Generados
1. **[`glosario.md`](glosario.md):** Lenguaje ubicuo del dominio.
2. **[`calidad.md`](calidad.md):** Modelo de calidad ISO/IEC 25010 con requisitos no funcionales cuantitativos y herramientas de verificación.
3. **[`riesgos.md`](riesgos.md):** Registro de riesgos técnicos y operativos con mitigación.
4. **[`dod.md`](dod.md):** Definición de Hecho (DoD) para tareas, historias de usuario y fases.
5. **[`adr/ADR-001.md`](adr/ADR-001.md):** Monolito modular con arquitectura hexagonal en monorepo pnpm.
6. **[`adr/ADR-002.md`](adr/ADR-002.md):** Stack tecnológico y estrategia de costo cero.
7. **[`srs.md`](srs.md):** Especificación de requisitos según ISO/IEC/IEEE 29148: categorías del MVP, reglas numéricas de verificación e historias de usuario (HU-01 a HU-12).
8. **[`trazabilidad.md`](trazabilidad.md):** Matriz requisito → historia → caso de uso → caso de prueba.

---

## [2026-10-11] — Revisión y corrección de la Fase 0

Una revisión de los artefactos anteriores encontró contradicciones entre documentos, reglas de negocio sin definir y contenido que no provenía del roadmap. Se corrigió antes de iniciar la Fase 1.

### Decisiones tomadas (confirmadas por el autor el 2026-10-11)
1. **Comunicación entre módulos:** un módulo nunca importa a otro, tampoco su `index.ts`. Las consultas entre módulos usan un puerto del módulo consumidor que conecta la raíz de composición. Unificado en ADR-001, DoD y roadmap.
2. **Dueño de la reputación:** el módulo `verification`, con tabla propia `reputations`. Se quita la columna `reputation` de `users`.
3. **Extensiones de vigencia:** la primera al pasar a `CONFIRMADO` (suma 3.0) y la segunda al alcanzar suma 6.0; ninguna más.
4. **Confirmar y resolver exigen al menos 2 votantes distintos**, además de la suma ponderada de 3.0.
5. **Silenciado recuperable:** la penalización por rechazo baja de 1.00 a 0.50 y la reputación vuelve a 0.5 tras 30 días sin penalizaciones. Los reportes de un silenciado se crean `ACTIVO` y pasan de inmediato a `RECHAZADO`, respetando la máquina de estados.
6. **Deduplicación por evento:** `reports` emite `ReportDuplicateDetected.v1` y `verification` lo registra como confirmación, en lugar de una llamada directa entre módulos.
7. **Rectángulo geográfico ampliado** a latitud [-16.67, -16.38] y longitud [-68.33, -68.00]. El anterior dejaba fuera Chasquipampa, Ovejuyo, Achumani, Cota Cota, Senkata, Ventilla y el Distrito 7 de El Alto (contrastado con OpenStreetMap).
8. **Parámetros nuevos** (SRS 3.3): límites de reportes y votos, máximo de zonas, distancia máxima para votar (1000 m) y tamaño de celda del mapa de calor.
9. **HU-10 alineada con la Fase 10:** el clasificador marca reportes sospechosos para moderación; no sugiere categorías.
10. **RNF-14 (privacidad)** añadido para dar ID trazable a la regla de no exponer `location` ni `author_id`.

### Otros cambios
- SRS reestructurado según ISO/IEC/IEEE 29148: interesados, restricciones, supuestos, requisitos funcionales con ID (RF-01 a RF-17), interfaces externas y verificación.
- HU-06 a HU-12 con criterios de aceptación Dado/Cuando/Entonces; escenarios añadidos en HU-01 a HU-05.
- Registro de riesgos depurado: se retiran mitigaciones ajenas al stack o de pago (ingesta de redes sociales, límite por IP) y se añaden RSK-08 (PWA en iOS) y RSK-09 (política de teselas de OSM).
- Matriz de trazabilidad con columna de requisito; el bot deja de figurar como módulo.
- RNF-09 sin la carga de 50 req/s, que no estaba en el roadmap.
- Enlaces de esta bitácora cambiados a rutas relativas.

### Criterio de Salida de Fase 0
- [x] SRS con todas las historias Imprescindibles y sus criterios de aceptación.
- [x] Tabla de categorías con TTL y reglas de verificación con valores numéricos.
- [x] RNF ISO/IEC 25010 con umbrales cuantitativos.
- [x] ADR-001 y ADR-002 aprobados por el autor del proyecto.
- [x] Registro de riesgos y DoD publicados.

**Estado:** Fase 0 completada al 100 %. Lista para iniciar la Fase 1 (Base arquitectónica y cadena de calidad).

### Pendientes fuera de los documentos
- La rama del repositorio es `master`; el flujo definido usa `main` (se resuelve en el paso 1 de la Fase 1).
- Actualizar la matriz de marco lógico: Next.js cambia a Vite.

---

## [2026-10-11] — Cierre de Fase 1: Base arquitectónica y cadena de calidad

### Resultado
Un esqueleto que compila, se prueba y se despliega, con la arquitectura hexagonal impuesta por la CI. Versión publicada: `v1.0.0`.

### Qué se construyó
- **Monorepo pnpm** con TypeScript estricto, ESLint (complejidad máxima 10), Prettier, Husky, Commitlint y Vitest con umbrales de cobertura por capa.
- **Paquetes base:** `shared-kernel`, `contracts`, `event-bus` (bus en memoria) y `platform` (configuración validada con Zod, interruptores `FEATURE_<MODULO>`, logger pino, pool de PostgreSQL).
- **Generador de módulos** (`pnpm gen:module`) y los nueve módulos de la arquitectura como esqueletos. El registro de módulos y las referencias de TypeScript se generan con `tools/modules/sync-modules.mjs`.
- **Reglas de arquitectura** en `.dependency-cruiser.cjs`, con una prueba automática que planta siete importaciones prohibidas y exige que todas se detecten.
- **API mínima:** `GET /health` (versión y estado de la base de datos), ID de correlación por solicitud y `ping` por Socket.io cada 5 s.
- **PWA mínima:** mapa Leaflet centrado en La Paz que muestra el último `ping`. JS inicial: 125 KB comprimido.
- **CI** con compuertas independientes: lint, typecheck, arquitectura, duplicación, pruebas con cobertura, build, auditoría y SonarCloud. Dependabot y semantic-release activos.
- **Staging:** API en Render, web en Vercel y base de datos en Neon con PostGIS.

### Evidencia del criterio de salida
- [x] **CI en verde con todas las compuertas activas.** Ejecución en `main` con SonarCloud incluido: compuerta de calidad `OK`, 0 bugs, 0 vulnerabilidades, 0 % de duplicación, 97,5 % de cobertura.
- [x] **Un PR que viola la arquitectura es rechazado.** PR #2 (un dominio importa infraestructura) rechazado por `dominio-solo-shared-kernel`; PR #3 (un módulo importa otro módulo) rechazado por `modulo-no-importa-otro-modulo`. Ambos cerrados sin fusionar.
- [x] **`/health` y el `ping` funcionan en staging.** `https://plataforma-gis-api.onrender.com/health` responde 200 con la base de datos arriba; un cliente recibe el `ping` por WebSocket a través del proxy de Render con el origen de `https://plataformagis-apps.vercel.app`. No hizo falta cambiar a Oracle Cloud.
- [x] **Un módulo se puede apagar y eliminar.** Con un módulo `sandbox` generado con plop: `FEATURE_SANDBOX=false` devuelve 404 y no procesa su evento; al borrar la carpeta y sincronizar, todo compila y las pruebas siguen en verde.

### Hallazgos
- **Error corregido (prueba primero):** al caerse la base de datos, el pool de `pg` emitía un `error` sin oyente y terminaba el proceso. Lo detectó la CI en la prueba de integración de `/health`.

### Desviaciones y decisiones
- **TypeScript 6, no 7:** typescript-eslint aún no admite la serie 7.
- **Auditoría bloqueante solo en producción:** `braces` tiene una vulnerabilidad alta sin versión corregida y entra únicamente por herramientas de desarrollo (plop, semantic-release). La auditoría de desarrollo se ejecuta como paso informativo. Revisar cuando exista un parche.
- **Un solo PR para toda la fase**, en lugar de los cuatro previstos en el plan.
- **Iconos de la PWA:** por ahora un SVG; los PNG definitivos llegan en la Fase 8.

### Pendientes que pasan a la siguiente fase
- **Proteger `main`:** resuelto el mismo día. Una regla exige PR y CI en verde; semantic-release escribe `CHANGELOG.md` con una clave de despliegue que la regla admite como excepción. Comprobado con la publicación de `v1.1.0`.
- **Rama remota `master`:** se conserva por decisión del autor; no afecta al flujo.
- **Alinear la versión de PostgreSQL:** Neon usa la 18 y la imagen local y de pruebas es la 17. Resolver antes de las migraciones de la Fase 3.
- **Contraseña de la base de datos de staging:** se rotará más adelante por decisión del autor.

---

## [2026-10-11] — Cierre de Fase 2: Modelo de dominio

### Resultado
Las reglas de negocio de los módulos Imprescindibles están escritas en TypeScript puro dentro de `domain/`, sin base de datos, HTTP ni frameworks, y probadas contra los valores del SRS.

### Qué se construyó
- **`shared-kernel`:** `GeoPoint` como objeto de valor que rechaza coordenadas fuera del área de servicio y mide distancias; constructores validados de `ReportId`, `UserId` y `CategoryCode`.
- **`contracts`:** los siete eventos de integración versionados, cada uno marcado como público o interno.
- **`identity`:** entidad `User` y puerto `UserRepository`.
- **`reports`:** `Category` con el catálogo del MVP, agregado `Report` con su máquina de estados y extensiones de vigencia, `ExpirationPolicy`, `PrivacyPolicy` y cuatro puertos.
- **`verification`:** `Vote`, `Reputation`, `VerificationPolicy`, `ReputationPolicy` y tres puertos.
- **README** de los tres módulos con su contrato: responsabilidad, eventos, puertos y tablas.

### Evidencia del criterio de salida
- [x] **Cobertura del dominio ≥ 95 %.** Vitest impone el umbral en `**/domain/**` y en `shared-kernel`; la suite pasa con 394 pruebas y una cobertura global del 99,7 % de sentencias y 100 % de líneas.
- [x] **0 dependencias externas en los dominios y en `shared-kernel`.** dependency-cruiser sin violaciones (reglas `dominio-solo-shared-kernel` y `shared-kernel-sin-dependencias`).
- [x] **Puertos y eventos definidos, con README e incluidos en la trazabilidad.** Sección 3 de `trazabilidad.md`.

### Pruebas destacadas
- **Máquina de estados:** las 7 transiciones válidas y las 13 inválidas, generadas desde la tabla de transiciones.
- **Basadas en propiedades (fast-check):** `GeoPoint`, `ExpirationPolicy`, `PrivacyPolicy`, `VerificationPolicy` y la proyección UTM.
- **Proyección UTM 19 Sur:** coincide con `ST_Transform` de PostGIS 3.5 con menos de 1 mm de diferencia en seis puntos del área de servicio.

### Decisiones de diseño (aprobadas en el plan de la fase)
1. **La ubicación pública se calcula en el dominio.** `PrivacyPolicy` usa una proyección UTM 19 Sur propia, sin librerías. El repositorio de la Fase 4 guardará esa ubicación tal cual; se ajustó el punto 6 de la Fase 4 del roadmap.
2. **Audiencia de los eventos.** Los eventos públicos solo llevan `publicLocation`; una prueba impide que incluyan la ubicación real o un usuario. `ReportDuplicateDetected` y `VoteCast` son internos.
3. **La decisión de verificación viaja en `VoteCast.v1`** (`NONE`, `CONFIRM`, `EXTEND`, `RESOLVE`). `verification` nunca modifica un reporte.
4. **Puertos añadidos** a los del roadmap: `UserRepository` y `AuthorStanding`.

### Reglas precisadas al implementar
El SRS no las detallaba; se resolvieron así y conviene revisarlas:
- **Prioridad de las negaciones.** Si un reporte reúne a la vez los umbrales de confirmación y de resolución, se resuelve.
- **Un usuario silenciado no gana reputación** por aciertos o reportes anteriores; solo se recupera por el plazo de 30 días.
- **Redondeo a dos decimales** en reputaciones y sumas de votos, para que los pasos de 0,05 no acumulen error.
- **En el instante exacto de la caducidad el reporte sigue vigente**; caduca cuando esa fecha ya pasó.
- **Borde del área de servicio.** Si el centro de la celda de 200 m cae fuera del rectángulo, la ubicación pública se acota al borde.
- **La descripción del reporte no se modeló.** El roadmap la prevé como paso posterior de la PWA (Fase 8) y el SRS no fija su longitud; se añadirá con su regla cuando se defina.

### Publicación de versiones
El primer PR de la fase publicó `v1.1.0`: semantic-release escribió el `CHANGELOG.md` en `main` protegida con la clave de despliegue, lo que cierra la comprobación que quedó abierta en la Fase 1.

### Pendientes que pasan a la siguiente fase
- **Alinear la versión de PostgreSQL:** resuelto el 2026-10-12. Docker local y las pruebas usan `postgis/postgis:18-3.6`, igual que Neon en staging (PostgreSQL 18.6, PostGIS 3.6). Los vectores de referencia de la proyección UTM son idénticos en PostGIS 3.5 y 3.6.

---

## [2026-10-12] — Cierre de Fase 3: Modelado de datos y persistencia PostGIS

### Resultado
El modelo de dominio de la Fase 2 ya se guarda en PostgreSQL 18 + PostGIS 3.6. Hay un esquema físico versionado, con migraciones reversibles por módulo, y los adaptadores de repositorio que implementan los puertos. Todavía no hay casos de uso ni rutas (Fases 5 y 6) ni consultas espaciales (Fase 4).

### Qué se construyó
- **`platform`:** ejecutor de migraciones (`migrateUp`, `migrateAll`, `revertLast`) con un historial por conjunto, la extensión PostGIS, la tabla `outbox_events` y `appendToOutbox`.
- **`testing`** (paquete nuevo, solo para pruebas): un único contenedor PostGIS por ejecución y una base de datos aislada por archivo de pruebas.
- **`identity`:** tabla `users` y `PgUserRepository`.
- **`reports`:** tablas `categories` (con su semilla) y `reports`, `PostgisReportRepository`, `PgCategoryRepository` y `PgReportUnitOfWork`. El agregado `Report` conserva ahora la clave de idempotencia.
- **`verification`:** tablas `votes` y `reputations`, `PgVoteRepository` y `PgReputationRepository`.
- **`subscriptions`:** dominio mínimo `ZoneSubscription`, tabla `zone_subscriptions` y `PgSubscriptionRepository`.
- **`moderation`:** tabla de auditoría `moderation_actions`.
- **Documentos:** `modelo-datos.puml` (diagrama E-R) y `diccionario-datos.md`.
- **Comandos:** `pnpm db:migrate` y `pnpm db:generate`.

### Evidencia del criterio de salida
- [x] **Diagrama E-R y diccionario de datos publicados.** `docs/modelo-datos.puml` y `docs/diccionario-datos.md`: 8 tablas, con el módulo dueño de cada una.
- [x] **Migraciones reproducibles desde cero en CI.** `apps/api/src/migrations.integration.test.ts` aplica el esquema completo sobre una base vacía en cada ejecución; además cada conjunto se aplica, se revierte y se vuelve a aplicar en su propia prueba. En local, `docker compose up -d` y `pnpm db:migrate` crean las 8 tablas y sus 18 índices.
- [x] **Todos los repositorios pasan las pruebas de integración.** Los siete adaptadores, contra PostGIS real con Testcontainers. La suite completa pasa con 562 pruebas y una cobertura global de 99,6 % de sentencias y 99,8 % de líneas.

### Pruebas destacadas
- **Restricciones de la base de datos:** rechaza un voto duplicado, un estado inválido, una clave de idempotencia repetida, un radio fuera de rango, una reputación fuera de [0, 5], una ubicación con otro sistema de referencia y un rechazo de moderación sin motivo.
- **Atomicidad:** si falla la escritura del evento en el outbox, el reporte tampoco se guarda.
- **Independencia de módulos:** con `FEATURE_SUBSCRIPTIONS=false` su tabla no se crea y el resto del esquema queda completo; encenderlo después añade solo sus tablas.
- **Semilla:** las categorías de la base coinciden con `MVP_CATEGORIES` del dominio.
- **Privacidad (RNF-14):** el repositorio guarda la ubicación pública que entrega el dominio, sin recalcularla.

### Decisiones de diseño (aprobadas en el plan de la fase)
1. **Reversas escritas a mano.** Drizzle Kit solo genera la migración de avance; cada una lleva su `<nombre>.down.sql`.
2. **Un historial de migraciones por módulo** (esquema `drizzle`). Un módulo apagado no ejecuta las suyas.
3. **Sin claves foráneas entre módulos**, aunque el roadmap las mencionaba en `reports.author_id` y `votes`. Se corrigió el texto del roadmap. La única clave foránea es `reports.category_code`, dentro de `reports`.
4. **`outbox_events` y la extensión PostGIS son de `platform`** y se aplican siempre primero.
5. **`idempotency_key` entra al agregado `Report`.** El dominio valida su formato y la base de datos su unicidad; procesar "una sola vez" sigue siendo de la Fase 5.
6. **`subscriptions` se modeló solo en lo mínimo** que pide su tabla; `moderation` solo tiene tabla.
7. **Unidad de trabajo como puerto de la capa de aplicación** (`ReportUnitOfWork`).

### Reglas precisadas al implementar
- **Radio de una zona en metros enteros.** El SRS da el rango (100 a 2000 m) pero no la precisión.
- **Una zona necesita al menos una categoría**, y las repetidas se guardan una sola vez.
- **Zonas y votos son inmutables:** solo se insertan (y las zonas se eliminan).
- **Dos votos simultáneos del mismo usuario:** la clave primaria rechaza el segundo y el adaptador lo traduce al mismo error de dominio que el caso normal (`AlreadyVotedError`).
- **Acciones de moderación:** `RECHAZAR` y `MANTENER`; el motivo es obligatorio solo al rechazar. Revisar al construir la moderación (Fase 10).
- **Índice del outbox:** sobre `created_at` para los eventos sin publicar (el roadmap decía `published_at`), porque se recorren en orden de llegada.

### Hallazgos
- **Drizzle Kit y los tipos espaciales.** Genera `geometry(point)` sin SRID y entrecomilla el tipo `geography`. Las dos migraciones afectadas se corrigieron a mano y lo indican en su primera línea; una prueba verifica que las columnas sean puntos con SRID 4326.
- **PostgreSQL 18 en Docker.** El volumen debe montarse en `/var/lib/postgresql` (no en `.../data`). La alineación de versiones previa solo se había probado con Testcontainers, no con `docker compose`.
- **Puerto local 5433.** El equipo de desarrollo ya tiene un PostgreSQL nativo en el 5432, así que el contenedor se publica en el 5433 (`docker-compose.yml` y `.env.example`).
- **SonarCloud contaba la utilería de pruebas como código de producción.** `packages/testing` se analiza ahora como código de prueba, y las exclusiones de cobertura coinciden con las de Vitest.

### Publicación de versiones
Cuatro PR (#12 a #15). Tras cada fusión se esperó a que terminara el flujo de publicación antes de fusionar el siguiente, y el choque de la Fase 2 no se repitió.

### Pendientes que pasan a la siguiente fase
- **Migrar staging.** Las migraciones no se aplicaron en Neon; se hará cuando la API empiece a usar las tablas (Fase 6), como parte del despliegue.
- **Columna `description` de `reports`:** sigue sin modelarse; se añadirá con una migración cuando el SRS fije su regla.
- **Consultas espaciales** (viewport, cercanía, duplicados, vencidos y zonas que contienen un punto): Fase 4. Los índices GiST ya existen.
- **Límite de 5 zonas por usuario y reputación inicial de un usuario sin fila:** son reglas de los casos de uso (Fase 5 en adelante).
- **Contraseña de la base de datos de staging:** sigue pendiente de rotar por decisión del autor.

---

## [2026-10-12] — Esquema de base de datos en español

### Motivo
A pedido del autor, para leer el modelo de datos con más facilidad: las tablas y columnas pasan a llamarse en español. Las clases, funciones y propiedades del código siguen en inglés; la equivalencia queda en `adapters/schema.ts` de cada módulo (la propiedad `expiresAt` es la columna `caduca_en`).

### Qué cambió
- **Convención:** español sin tildes ni eñes, en `snake_case`; los identificadores llevan el prefijo `id_` y las fechas terminan en `_en`. Los nombres de restricciones e índices siguen al de su tabla.
- **Tablas:**

| Antes | Ahora |
| :--- | :--- |
| `outbox_events` | `eventos_salida` |
| `users` | `usuarios` |
| `categories` | `categorias` |
| `reports` | `reportes` |
| `votes` | `votos` |
| `reputations` | `reputaciones` |
| `zone_subscriptions` | `zonas_suscritas` |
| `moderation_actions` | `acciones_moderacion` |

- **Migraciones regeneradas, no encadenadas.** Como ninguna base con datos las tenía aplicadas (staging sigue sin migrar), se reescribieron las migraciones iniciales en lugar de añadir otras de renombrado. La base local se recreó vacía.
- **Documentos:** `modelo-datos.puml`, `diccionario-datos.md`, la lista de tablas de la Fase 3 y las referencias a columnas de las Fases 4, 7 y 10 del roadmap, la sección 4 de `trazabilidad.md`, el glosario y los README de los módulos.

### Qué no cambió
- Los nombres del SRS y de la API (`location`, `public_location`, `author_id`, `idempotency_key`) se mantienen: son campos del contrato, no columnas.
- Los módulos (`reports`, `identity`...) y sus historiales de migraciones (`drizzle.migrations_reports`) conservan su nombre.
- Las entradas anteriores de esta bitácora usan los nombres antiguos de las tablas.

### Verificación
`pnpm lint`, `pnpm typecheck`, `pnpm depcruise`, `pnpm duplication` y `pnpm test` en verde: 562 pruebas, misma cobertura. `pnpm db:migrate` sobre la base local crea las 8 tablas y los 18 índices con los nombres nuevos.

## [2026-10-12] — Código en español

### Motivo
A pedido del autor, para leer todo el proyecto en español: clases, funciones, variables, eventos y campos del contrato pasan a llamarse en español. Es el "pedido expreso" que la regla de idioma de `CLAUDE.md` exigía para renombrar el código anterior a la Fase 4.

### Qué cambió
- **Núcleo y plataforma:** `GeoPoint` → `PuntoGeo`, `DomainError` → `ErrorDeDominio`, `EventBus` → `BusDeEventos`, `ModuleDefinition` → `DefinicionDeModulo` (`name`, `register` → `nombre`, `registrar`), `AppConfig` → `ConfigApp`, `appendToOutbox` → `agregarASalida`, entre otros.
- **Dominio de los módulos:** `Report` → `Reporte`, `User` → `Usuario`, `Vote` → `Voto`, `Reputation` → `Reputacion`, `ZoneSubscription` → `ZonaSuscrita`; sus métodos y propiedades (`findById` → `buscarPorId`, `expiresAt` → `caducaEn`, `markConfirmed` → `marcarConfirmado`) y sus repositorios.
- **Eventos de integración:** `ReportCreated.v1` → `ReporteCreado.v1`, `ReportConfirmed` → `ReporteConfirmado`, `ReportResolved` → `ReporteResuelto`, `ReportExpired` → `ReporteCaducado`, `ReportRejected` → `ReporteRechazado`, `ReportDuplicateDetected` → `ReporteDuplicadoDetectado`, `VoteCast` → `VotoEmitido`.
- **Campos de los eventos:** `reportId` → `idReporte`, `expiresAt` → `caducaEn`, `status` → `estado`, `reason` → `motivo`, `voterId` → `idVotante`, `value`/`weight` → `valor`/`peso`, `latitude`/`longitude` → `latitud`/`longitud`, y el sobre (`type`, `occurredAt`, `payload` → `tipo`, `ocurridoEn`, `contenido`). La audiencia pasa a `'publico'`/`'interno'` y la decisión de verificación a `NINGUNA`/`CONFIRMAR`/`EXTENDER`/`RESOLVER`.
- **Resultado:** `Result` → `Resultado` con `exitoso`/`valor` en lugar de `ok`/`value`. Los códigos de error estables (`INVALID_TRANSITION` → `TRANSICION_INVALIDA`, etc.) también están en español.
- **Aplicaciones:** `buildApp` → `construirApp`, `attachRealtime` → `adjuntarTiempoReal`; el evento `ping` lleva `{ secuencia, en }`; `MapView` → `VistaMapa`, `PingStatus` → `EstadoDePing`.
- **Generador de módulos:** la plantilla y `sync-modules.mjs` producen `<modulo>Modulo: DefinicionDeModulo` (por ejemplo `reportsModulo`) y la lista `modulos`.

### Qué no cambió
- Los campos del contrato del SRS: `location`, `publicLocation` (`public_location`), `authorId` (`author_id`), `idempotencyKey` (`idempotency_key`).
- Los nombres de los módulos, sus carpetas, `@gis/module-*` y `FEATURE_<MODULO>`; lo que imponen las librerías (Fastify, Socket.io, React, Leaflet, Drizzle, Zod); las variables de entorno; `/health`; los eventos `connect` y `disconnect` de Socket.io.
- Los nombres de archivo (`report.ts`, `vote.ts`...), las tablas y las columnas.
- Las entradas anteriores de esta bitácora y el `CHANGELOG.md` conservan los nombres antiguos.

### Decisión sobre los eventos
Los eventos se renombraron dentro de `v1` y no se creó una `v2`: todavía no hay datos en producción ni consumidores externos, así que no hay filas ni clientes que migrar. Una base local con filas en `eventos_salida` guarda el nombre anterior en `tipo`; basta vaciarla.

### Verificación
`pnpm lint`, `pnpm typecheck` y `pnpm test` en verde: 562 pruebas.

## [2026-10-12] — Fase 4: core geoespacial

### Qué se hizo
- **Consultas espaciales de `reports`** en `RepositorioDeReportes` y su adaptador PostGIS: `buscarEnVentana`, `buscarCercanos`, `buscarDuplicado` y `buscarCaducados`.
- **Mapa de calor** en `heatmap`: puerto `ConsultaDeMapaDeCalor` y adaptador `ConsultaMapaCalorPg` con `ST_SnapToGrid`; solo publica celdas con al menos 3 reportes.
- **Suscriptores** en `subscriptions`: `RepositorioDeSuscripciones.buscarSuscriptores(punto, categoria)`.
- **Celdas geohash** en `shared-kernel`: `celdaDe` y `celdasQueCubren`, sin librería. Coinciden con los vectores publicados y con `ST_GeoHash` de PostGIS.
- **Medición:** `pnpm seed:load` carga 100.000 reportes y 5.000 zonas sintéticos y reproducibles; `pnpm perf:espacial` mide cada consulta, también en su peor caso, y archiva su plan en `docs/rendimiento/consultas-espaciales.md`.

### Decisiones
1. **`heatmap` lee la tabla `reportes` directamente (ADR-003).** Es una excepción acotada al ADR-001: solo `SELECT`, solo columnas públicas y solo agregados. La decidió el autor frente a mover la consulta a `reports` o esperar a una tabla propia alimentada por eventos.
2. **Índices (migración `0002_indices_de_consulta` de `reports`).** Se añade `reportes_ubicacion_geography_idx`, porque `ST_DWithin` en metros trabaja sobre `geography`, y `reportes_creado_en_idx`, para servir primero los reportes recientes y los rangos de fechas. Se elimina `reportes_ubicacion_idx`, que ninguna consulta usaba.
3. **`buscarSuscriptores` acota primero con el radio máximo (2000 m).** El radio de cada zona es una columna y el índice GiST solo acelera una distancia constante; después se aplica el radio propio de la zona.
4. **La ventana pública devuelve `ReportePublico`,** una proyección sin ubicación real ni autor. Su campo se llama `publicLocation`, como en el agregado y en el SRS.
5. **`buscarEnVentana` exige los estados y un límite de filas.** Sin estados lanza un error: una lista vacía no puede significar "todos", porque incluiría los rechazados. Devuelve los más recientes primero. `buscarCercanos` solo devuelve reportes vigentes y también lleva límite.
6. **La cuadrícula del mapa de calor es fija para toda la ciudad** y la ventana se amplía a celdas enteras. Si la cuadrícula dependiera de la ventana, moverla unos metros cambiaría los conteos y permitiría aislar un reporte pese al umbral de 3.
7. **El mapa de calor cuenta todos los reportes salvo los `RECHAZADO`,** también los caducados y resueltos: es un mapa histórico por rango de fechas. La celda mide entre 100 m y 5000 m.
8. **Las celdas geohash van en `shared-kernel`,** no en `reports`: las usará la capa de tiempo real de la Fase 7 sin importar ningún módulo. `celdasQueCubren` rechaza un área que necesite más de 2.500 celdas.
9. **Los módulos exportan sus adaptadores desde `index.ts`** (`RepositorioReportesPostgis`, `RepositorioSuscripcionesPg`, `ConsultaMapaCalorPg`) para que la raíz de composición los construya.
10. **Tiempos de espera de la suite:** `pnpm test` da 20 s por prueba y 30 s por preparación. Con más archivos de integración creando su base de datos a la vez, los 5 s y 10 s por defecto no alcanzaban.

### Revisión antes del cierre
Una revisión de la primera versión encontró y corrigió: la ventana devolvía rechazados con la lista de estados vacía; la ventana y la cercanía no tenían tope de filas; la cuadrícula del mapa de calor se movía con la ventana; `ReportePublico` usaba `ubicacionPublica` en lugar de `publicLocation`; el mapa de calor no se probaba contra el esquema real en la CI (ahora `apps/api/src/mapa-calor.integration.test.ts`); y quedaba un índice sin uso. Al medir los peores casos apareció además un recorrido completo de la tabla en la ventana y en el mapa de calor de toda la ciudad, que resolvió `reportes_creado_en_idx`.

### Resultado de la medición
Con 100.000 reportes y 5.000 zonas en el PostGIS local (PostgreSQL 18.6, PostGIS 3.6.4), las nueve mediciones usan índice. El p95 más alto es el del mapa de calor de toda el área de servicio en los últimos 30 días: 40,5 ms, frente al máximo de 100 ms. El detalle y los planes están en `docs/rendimiento/consultas-espaciales.md`.

### Pendiente para fases siguientes
- `buscarCercanos` la pide el roadmap, pero ninguna historia la consume todavía.
- Un mapa de calor de toda la ciudad con un rango de fechas que abarque casi toda la historia recorrerá la tabla completa: ningún índice lo evita y es el plan correcto. El caso de uso de la Fase 5 debe acotar el rango.
- La medición es de un solo cliente; la prueba de carga con k6 es de una fase posterior.
- Los casos de uso que llaman a estas consultas (`CreateReport`, `ExpireReports`, `GetHeatmap`, `NotifySubscribers`) son de la Fase 5.

## [2026-10-14] — Fase 5: casos de uso

### Qué se hizo
- **Casos de uso** en `application/` de cada módulo, cada uno una clase con `ejecutar(entrada)`, entrada validada con Zod y puertos por constructor:
  - `identity`: `RegistrarDispositivo`.
  - `reports`: `CrearReporte`, `ListarReportesEnVentana` y `CaducarReportes`.
  - `verification`: `ConfirmarReporte` y `NegarReporte`.
  - `subscriptions`: `SuscribirZona` y `EliminarZona`.
  - `heatmap`: `ObtenerMapaDeCalor`.
  - `moderation`: `RechazarReporte`.
- **Manejadores de eventos** (`manejar(evento)`), que es como se encadenan los módulos:
  - `RegistrarConfirmacionPorDuplicado`, `AplicarDecisionDeVerificacion`, `AplicarRechazoDeModeracion` y `AjustarReputacionPorDesenlace`;
  - `NotificarSuscriptores`, que solo escucha `ReporteCreado`.
- **Piezas comunes:**
  - `shared-kernel`: errores de aplicación tipados (`ErrorDeAplicacion` y sus cinco subclases, con `aErrorDeAplicacion` para traducir errores de dominio) y los puertos `LimitadorDeFrecuencia` y `GeneradorDeId`, que antes estaba en `reports`.
  - `contracts`: `crearEvento`, `leerContenido` y `validarEntrada`.
  - `platform`: `esClaveDuplicada`.
  - `testing`: los dobles `RelojFijo`, `GeneradorDeIdSecuencial` y `LimitadorEnMemoria`.
- **Eventos nuevos:** `ReporteExtendido.v1`, que es público (el agregado ya lo producía y faltaba en el contrato), y `RechazoDeModeracion.v1`, que es interno.
- **Adaptadores nuevos:**
  - `UnidadDeTrabajoVotoPg` y `UnidadDeTrabajoModeracionPg`.
  - `UnidadDeTrabajoReportePg` ahora también registra eventos sin reporte y traduce la clave de idempotencia repetida a un conflicto.
  - `moderation` estrena su dominio: `AccionDeModeracion`.
- **Raíz de composición:** `apps/api/src/composicion/puentes.ts` conecta los puertos entre módulos (`ConsultaDeReporte`, `ConsultaDeAutor`, `ReputacionDelAutor`). `apps/api/src/casos-de-uso.integration.test.ts` encadena los módulos reales sobre PostGIS con un despachador mínimo del outbox.

### Decisiones y cambios respecto al roadmap
1. **Nombres en español:** `ejecutar(entrada)` en lugar de `execute(input)`, y los casos de uso con nombres en español (`CrearReporte`, `CaducarReportes`, etc.). El roadmap de la Fase 5 quedó actualizado; las fases siguientes se renombrarán al planificarlas.
2. **`NotificarSuscriptores` solo reacciona a `ReporteCreado`**, por decisión del autor: el roadmap decía "o `ReporteConfirmado`", pero HU-08 exige un solo aviso por reporte y `ReporteConfirmado.v1` no trae categoría ni ubicación. Vive en `subscriptions`, dueño de las zonas, y busca con la ubicación pública, la única que viaja en el evento.
3. **La reputación se ajusta con el desenlace, no con la decisión.** `AjustarReputacionPorDesenlace` escucha `ReporteConfirmado`, `ReporteResuelto` y `ReporteRechazado`: si `reports` no llega a aplicar una decisión, porque el reporte caducó entre medio, nadie gana ni pierde reputación.
4. **El rechazo de un moderador viaja por evento.** `RechazarReporte` vive en `moderation`, que es un módulo opcional con su interruptor, guarda la auditoría y emite `RechazoDeModeracion.v1`; `reports` aplica el cambio de estado. El rol del actor llega en la entrada, desde la credencial de la Fase 6.
5. **Idempotencia antes que el límite:** un reenvío con la misma clave devuelve el resultado original sin consumir cupo. Si dos envíos llegan a la vez, la restricción única decide y el perdedor devuelve el reporte ganador. Una clave usada por otro usuario es un conflicto.
6. **Autor silenciado (SRS 3.2.7):** su reporte se guarda `RECHAZADO` sin ningún evento, y la respuesta, incluso al reenviarlo, se lo muestra `ACTIVO`: no recibe aviso.
7. **Mapa de calor acotado a 90 días** por consulta, tal como pedía la nota de la Fase 4, con celda de 250 m por defecto.
8. **Errores de aplicación en `shared-kernel`:** son tipos sin dependencias que usan todos los módulos. Zod queda fuera, en `contracts`, que ya dependía de él.
9. **Los manejadores son idempotentes ante una transición imposible o un voto repetido**, porque el despachador de la Fase 7 entregará cada evento al menos una vez.

### Verificación
`pnpm lint`, `pnpm typecheck`, `pnpm depcruise` (sin violaciones), `pnpm duplication` (0,54 %) y `pnpm test` en verde: 95 archivos y 953 pruebas, con Docker. La cobertura global es de 99,5 % y la de cada carpeta `application/`, de 98 % o más.

### Pendiente para fases siguientes
- **`AjustarReputacionPorDesenlace` no es idempotente.** Si el despachador de la Fase 7 entrega dos veces el mismo `ReporteConfirmado`, el premio se aplica dos veces. Hace falta registrar los eventos ya procesados (una bandeja de entrada por manejador) al implementar la entrega "al menos una vez".
- **Límite de zonas por usuario:** se comprueba leyendo y luego guardando, así que dos altas simultáneas podrían dejar 6 zonas. Es aceptable para el piloto; si importa, se resuelve con un bloqueo o un conteo en la base.
- **Adaptadores pendientes:** el `LimitadorDeFrecuencia` real (`@fastify/rate-limit`, Fase 6) y el `EnviadorDeNotificaciones` de log (Fase 7). Los manejadores se registran en el bus con el despachador de la Fase 7.
- `buscarCercanos` sigue sin consumidor: lo usará `/cerca` del bot (Fase 9).

## [2026-10-17] — Fase 6: API REST y seguridad

### Qué se hizo
- **Rutas `/v1`** en `apps/api/src/http/rutas/v1.ts`, delgadas: validan con el contrato, llaman al caso de uso y traducen el resultado.
  - `dispositivos`, `reportes`, `reportes/:id/confirmar` y `/negar`;
  - `mapa-calor`, `suscripciones` y `moderacion/reportes/:id/rechazar`, que solo se registran si su módulo está activo.
- **Contrato HTTP** en `packages/contracts/src/http.ts` (Zod). Valida las solicitudes, serializa las respuestas y genera el OpenAPI 3.1, publicado en `/docs` y `/docs/json` con `fastify-type-provider-zod` y `@fastify/swagger`.
- **Cliente `@gis/api-client`:**
  - `pnpm gen:api` escribe `openapi.json`, y `openapi-typescript` genera los tipos;
  - `crearClienteApi` usa `openapi-fetch` y agrega el token.
- **Raíz de composición** en `apps/api/src/composicion/casos-de-uso.ts`: el único lugar que instancia adaptadores. `main.ts` solo lee la configuración, compone y arranca.
- **Seguridad:**
  - JWT HS256 con `jose`, con expiración y rotación de clave (`JWT_SECRET_ANTERIOR`);
  - `@fastify/helmet`, CORS restringido a la PWA y cuerpo de hasta 16 KB;
  - `@fastify/rate-limit` por IP y `LimitadorDeFrecuenciaEnProceso` por usuario;
  - errores RFC 7807 y apagado ordenado con tiempo máximo.
- **Staging:**
  - `render.yaml` aplica las migraciones al arrancar, activa `heatmap`, `subscriptions` y `moderation`, y declara `JWT_SECRET`;
  - el flujo `ZAP` escanea staging tras cada versión;
  - `tools/carga/api-basica.js` es el escenario de k6.

### Decisiones y cambios respecto al roadmap
1. **Rutas, parámetros y campos en español**, por decisión del autor: `/v1/reportes`, `bbox`, `categorias`, `desde` y `hasta`. Se conservan `publicLocation` (contrato del SRS) y la cabecera estándar `Idempotency-Key`. `bbox` se escribe `lonMin,latMin,lonMax,latMax`.
2. **Dos niveles de límite.** `@fastify/rate-limit` no puede ser el adaptador de `LimitadorDeFrecuencia`, porque limita solicitudes y no claves arbitrarias. Por eso protege la API por IP (300 por minuto), y los límites de 5 reportes y 30 votos por usuario usan un adaptador en memoria del proceso. Basta con una instancia; con varias haría falta un almacén común.
3. **El rol viaja en el token.** `RechazarReporte` lo valida. Un ascenso a moderador surte efecto al renovar el token (24 h como máximo).
4. **Configuración HTTP aparte** (`cargarConfigHttp`). `JWT_SECRET` es obligatorio solo en producción, así las migraciones y el desarrollo local no lo necesitan.
5. **Migraciones en Render con `tsx`** (`pnpm db:migrate` antes de arrancar). Empaquetadas con `tsup` no encontrarían las carpetas `migrations` de los módulos.
6. **`POST /v1/reportes` responde 201 con `CREADO` y 200 con `DUPLICADO` o `PROPIO_EXISTENTE`.** El rechazo de un moderador responde 202, porque `reports` lo aplica al procesar el evento.
7. **Versión del contrato fija (`1.0.0`)** en el OpenAPI, para que el documento no cambie en cada despliegue.

### Verificación local
- `pnpm lint`, `typecheck`, `depcruise` (sin violaciones), `duplication` (0,45 %) y `test` pasan: 99 archivos y 1007 pruebas, con Docker. La cobertura global es del 99 %.
- La API compilada responde `/health`, el registro con JWT, `/docs` y las cabeceras de seguridad.
- k6 contra la API local: 382 solicitudes, 0 fallidas, p95 global de 12,7 ms. La medición que cuenta para el criterio de salida es la de staging.

### Cierre en staging (2026-10-17)
Con `v2.3.0` desplegada en Render y Neon migrado al arrancar. El detalle está en `docs/rendimiento/api-staging.md`.
- **ZAP baseline:** 0 hallazgos altos.
- **k6:** 344 solicitudes, 0 fallidas y p95 global de 245 ms (máximo 300 ms). El registro de dispositivo da 481 ms de p95, pero con solo 4 muestras, y no se repite por usuario.

### Pendiente
- **Avisos medios de ZAP en `/docs` (Swagger UI):** CSP con comodín y sin directiva de respaldo, y la versión de su bundle de JavaScript. Revisarlos o restringir `/docs` en producción (Fase 12).
- **Cabeceras `Permissions-Policy` y `Cross-Origin-Embedder-Policy`:** las marca ZAP como hallazgo bajo.
- **Hasta el despachador de la Fase 7,** un voto queda registrado, pero el estado del reporte no cambia: los eventos esperan en el outbox.

## [2026-10-17] — Fase 7: tiempo real y fiabilidad de eventos

### Qué se hizo
- **Entrega fiable de eventos** en `platform`:
  - `BusDeEventosConSalida` implementa el puerto `BusDeEventos`, que ahora pide un nombre estable por manejador.
  - `DespachadorDeSalida` entrega el outbox al menos una vez, con `FOR UPDATE SKIP LOCKED`.
  - La migración `0002_entrega_de_eventos` añade `intentos`, `ultimo_error` y `proximo_intento` al outbox, y la bandeja de entrada `eventos_procesados`.
- **Reacciones entre módulos conectadas** en `apps/api/src/composicion/manejadores.ts`: decisión de voto, rechazo de moderación, confirmación por duplicado, reputación y aviso a suscriptores (que por ahora va al log).
- **Tiempo real** en `apps/api/src/tiempo-real/`:
  - el handshake exige el JWT de la API;
  - `viewport:actualizar` pone al cliente en las salas `celda:<geohash>` de su ventana, con precisión 6 y, si la ventana es grande, 5;
  - los eventos públicos se emiten a la celda de la ubicación pública del reporte;
  - `connectionStateRecovery` cubre desconexiones de hasta 2 minutos.

  Se retiró el `ping` de la Fase 1.
- **Caducidad automática:** `ProgramadorDeTareas` ejecuta `CaducarReportes` cada 60 s.
- **`pnpm carga:difusion`** mide la latencia de difusión con 500 clientes.

### Decisiones y cambios respecto al roadmap
1. **Bandeja de entrada por manejador** (`eventos_procesados`). Resuelve el pendiente de la Fase 5: si un manejador falla, el evento se reintenta solo para él, sin repetir a los demás. Solo puede haber un duplicado si el proceso muere entre el éxito de un manejador y su registro.
2. **Reintentos con espera exponencial** (2^n s, hasta 5 min). A los 10 intentos el evento se descarta con su error, para que un evento envenenado no bloquee la cola.
3. **Entrega en paralelo por reporte.** Con la carga sintética local, una ráfaga de 20.000 caducidades retrasó 20 s los `ReporteCreado` nuevos (bloqueo en cabeza de cola). Ahora un lote se agrupa por reporte: los eventos de un mismo reporte van en orden y los de reportes distintos, en paralelo, hasta 8 a la vez. Los entregados se marcan con una sola escritura.
4. **El publicador busca la ubicación pública del reporte** para los eventos que no la traen (`ReporteConfirmado`, `ReporteCaducado`, etc.), en lugar de crear versiones nuevas de esos eventos.
5. **`setInterval` en vez de `node-cron`**, porque para un intervalo fijo no hace falta otra dependencia. **Script propio en vez de Artillery**, porque medir desde el POST de un cliente hasta la recepción en otros exige lógica que su motor no tiene.
6. **El socket exige token**, por decisión del autor.
7. **La recuperación de Socket.io necesita que el cliente ya haya recibido algún paquete.** La PWA debe pedir `GET /v1/reportes` al reconectar si `socket.recovered` es `false`.

### Verificación local
- `pnpm carga:difusion` contra la API local: 500 clientes, 20 reportes, 1000 de 1000 entregas, 0 a otras zonas, p95 de 263 ms.

### Cierre en staging (2026-10-17)
Con `v2.4.0` desplegada y el monitor de UptimeRobot activo. El detalle está en `docs/rendimiento/difusion-staging.md`.
- **Difusión con 500 clientes:** 1000 de 1000 entregas, 0 a otras zonas, p95 de 524 ms (máximo 2 s).
- **0 eventos perdidos al reiniciar:** prueba automática del despachador.
- **Caducidad automática:** el reporte de prueba (TTL de 120 min) pasó solo a `CADUCADO` y su `ReporteCaducado` llegó por WebSocket menos de un minuto después del vencimiento.

### Pendiente
- **`apps/web` sigue esperando el `ping`,** que ya no existe. La PWA se rehace sobre el protocolo nuevo en la Fase 8.
- **Escalar a varias instancias** exigiría el adaptador de Redis para Socket.io y un limitador compartido.

## [2026-10-18] — Fase 8a: PWA, identidad visual, mapa en vivo y reporte sin conexión

### Qué se hizo
- **Proceso de diseño con impeccable:**
  - `apps/web/PRODUCT.md` recoge la verdad del producto;
  - la dirección visual se eligió en tres rondas de decisión;
  - el autor fijó **«Señalética de Mi Teleférico»**: cada categoría es una línea de color y cada reporte, una estación;
  - el contrato de dirección está en `apps/web/.impeccable/surfaces/mapa.md`, y el sistema construido, en `apps/web/DESIGN.md`.
- **PWA nueva en `apps/web`** (reemplaza el esqueleto del `ping` de la Fase 1), organizada en `domain`, `services`, `features` y `ui`:
  - sesión anónima con token en IndexedDB;
  - mapa Leaflet con carga por ventana y agrupación de marcadores (`leaflet.markercluster`);
  - tiempo real por celdas con recuperación;
  - panel «Cerca de ti» como diagrama de línea;
  - reporte en dos toques;
  - cola sin conexión con Background Sync.
- **Service worker** con Workbox (`injectManifest`): precaché de la app y caché de teselas de OSM limitada a 400 entradas y 7 días.
- **Revisión final de impeccable:** veredicto «corregir», con seis correcciones, todas aplicadas:
  - sin GPS el panel se titula «En esta zona» y mide desde el centro del mapa;
  - teselas en gris;
  - zoom solo en escritorio, con botones de 48 px;
  - diagrama de 4 filas más «y N más»;
  - una estación en lugar del «+» del botón;
  - sin halo en el indicador en vivo.

### Decisiones
1. **Nombre y alcance:** «Alerta La Paz y El Alto» («Alerta LP»). La descripción y la foto del reporte pasan a la Fase 10, con la moderación. La Fase 8 se entrega en tres PR (8a, 8b y 8c).
2. **Token en IndexedDB y no en `localStorage`,** porque el service worker lo necesita para enviar la cola en segundo plano.
   - No hay riesgo de CSRF, porque va en la cabecera.
   - El de XSS se acota sin `innerHTML` de datos externos (la estación es SVG propio) y con una CSP estricta, prevista para la 8c.
3. **Un 4xx sale de la cola y se informa; un 5xx o la falta de red la dejan pendiente.** La `Idempotency-Key` hace seguro cualquier reenvío.
4. **Orden estricto de la cola** con un número monótono. Las pruebas encontraron que dos reportes guardados en el mismo milisegundo podían enviarse fuera de orden.
5. **Fuente Atkinson Hyperlegible Next,** alojada con la app: muy legible al sol y para personas mayores (`PRODUCT.md`).

### Verificación
- 55 pruebas de la web, con axe-core en el panel y en la hoja.
- JS inicial: 157 KB comprimidos, más 2 KB de `workbox-window`; service worker de 9 KB.
- Recorrido en Chrome (móvil 390×844 y escritorio) contra la API local, con una ronda de capturas y una de confirmación.

### Pendiente
- **8b:** detalle y votos, aviso «¿Sigue ahí?», filtros, mapa de calor y zonas.
- **8c:**
  - Web Push con su backend e instalación en iPhone;
  - iconos PNG (en esta máquina no hay conversor de imágenes);
  - Playwright contra staging y Lighthouse CI.

## [2026-10-18] — Fase 8b: votos, «¿Sigue ahí?», filtros, mapa de calor y zonas

### Qué se hizo
- **Backend mínimo:** `GET /v1/suscripciones` (caso de uso `ListarZonas` del módulo `subscriptions`) para listar las zonas propias, que la HU-07 pide y la API no ofrecía. Contrato regenerado con `pnpm gen:api`.
- **Detalle del reporte (HU-03):** se abre al tocar una estación del mapa o una fila del panel. Muestra el estado, la distancia, desde cuándo y hasta cuándo se ve, y los botones «Sigue ahí» / «Ya no está» con la posición del momento. Se cierra con un aviso si el reporte deja el mapa.
- **Memoria del dispositivo** en IndexedDB (almacén v2, con migración desde la v1): reportes propios, votados y por los que ya se preguntó. Evita ofrecer votos que la API rechazaría sin exponer nunca `author_id`.
- **«¿Sigue ahí?» automático:**
  - solo con el permiso de ubicación ya concedido y la app visible;
  - una tarjeta sobre el mapa ante un reporte a menos de 150 m, una sola vez por reporte;
  - el mapa se desplaza para dejar la estación a la vista.
- **Filtros** por línea y por antigüedad (1 hora, 3 horas, hoy), en el cliente y recordados en `localStorage`. La franja de la red raya las líneas ocultas y el panel dice cuántos incidentes esconden.
- **Historial (HU-06):** interruptor «Ahora / Historial» con el mapa de calor de `GET /v1/mapa-calor` (7, 30 o 90 días). `leaflet.heat` se carga bajo demanda, en un chunk aparte de 2 KB.
- **Zonas (HU-07):** lista, eliminación con confirmación y editor con mira fija, radio deslizante (100–2000 m) y líneas a elegir. Las zonas guardadas se dibujan con trazo discontinuo.
- **Revisión de acabado de impeccable:** veredicto «corregir», con ocho correcciones, todas aplicadas:
  - la tarjeta pasa abajo del mapa, sin tapar sus herramientas;
  - las fichas del editor ya no usan el estado de la estación para encendido o apagado;
  - la mira es una cruz y no un anillo (el anillo es solo del reporte);
  - rótulos de sección y botones primarios unificados;
  - distancia también sin GPS;
  - el aviso viejo de ubicación se borra al llegar una posición.

### Decisiones
1. **Los votos no se encolan sin conexión:** dependen de dónde está la persona en ese momento (la API exige 1 km o menos).
2. **Filtros en el cliente**, sobre la lista de la caché: no vuelven a pedir datos y los eventos en vivo siguen llegando.
3. **El calor usa solo la escala de tinta:** los colores de línea ya significan una categoría. La intensidad de cada celda es su puesto entre todas (percentil), porque con recuentos parecidos la escala lineal daba un velo uniforme.
4. **El filtro está en el mapa y no en el panel:** afecta a las dos capas, y en el teléfono el panel no tenía ancho para un botón más.
5. **El aviso automático nunca pide el permiso de ubicación** por su cuenta.

### Verificación
- La batería completa en verde, con axe-core en cada hoja nueva.
- JS inicial: 166 KB comprimidos.
- Recorrido en Chrome (móvil 390×844 y escritorio) contra la API local con semillas, y una ronda de revisión de acabado con recaptura y confirmación.

### Pendiente (8c)
- Web Push con su backend y los avisos reales de las zonas.
- Ayuda para instalar e iconos PNG.
- Playwright contra staging, Lighthouse CI y las casillas del roadmap.

## [2026-10-19] — Fase 8c: avisos Web Push, instalación y verificación

### Qué se hizo
- **Módulo `notifications`** (antes un esqueleto vacío):
  - entidad `SuscripcionPush`, tabla `suscripciones_push` con su reversa, casos de uso para registrar, eliminar y enviar el aviso, y adaptadores `RepositorioSuscripcionesPushPg` y `EmisorWebPush` (librería `web-push` con VAPID);
  - interruptor `FEATURE_NOTIFICATIONS`; sin él o sin las claves VAPID, los avisos vuelven al log.
- **Raíz de composición:** `EnviadorDeNotificacionesPush` une `subscriptions` (a quién avisar) con `notifications` (cómo enviar) sin que un módulo importe al otro.
- **Rutas:** `GET /v1/notificaciones/clave-publica`, `POST` y `DELETE /v1/notificaciones/push`. Contrato y cliente regenerados.
- **PWA:**
  - activar y desactivar los avisos en «Mis zonas»;
  - el service worker muestra el aviso y, al tocarlo, abre la app en el reporte;
  - ayuda para instalar (aviso del navegador en Android y escritorio, pasos de Safari en iPhone) y oferta única en el panel;
  - iconos PNG (192, 512, maskable y `apple-touch-icon`) generados con `@resvg/resvg-js`, y manifiesto completo;
  - CSP y cabeceras de seguridad en `apps/web/vercel.json`.
- **Verificación:**
  - Playwright (`apps/web/e2e/`) por historia, con axe-core en el navegador real, y el flujo `.github/workflows/e2e.yml` contra staging después de cada Release;
  - Lighthouse CI y el presupuesto de JS en cada PR (`ci.yml`, `lighthouserc.json`, `tools/presupuesto/js-inicial.mjs`).

### Decisiones
1. **`EnviarAvisoPush` no lanza ante un envío fallido:** solo los cuenta. Si lanzara, el manejador del evento se reintentaría y repetiría el aviso a quienes sí lo recibieron. Las suscripciones vencidas (404 o 410) se borran.
2. **La clave VAPID pública la da la API**, así la web no necesita otra variable por entorno.
3. **Playwright usa el Chromium completo sin interfaz:** el mínimo (`headless-shell`) deniega siempre las notificaciones.
4. **La prueba de HU-08 simula solo `pushManager.subscribe`:** un navegador automatizado no puede hablar con el servicio push real (FCM). El permiso, el alta y la baja contra la API son reales; la entrega se prueba en el backend con un emisor falso.
5. **Teselas iniciales precargadas:** la primera tesela del mapa era el LCP (3,7 s, Performance 87). El build calcula las teselas del centro de La Paz en zoom 15 y las precarga sin `crossorigin`, igual que Leaflet, para reutilizarlas. El LCP pasó a 3,0 s y Performance a 93.
6. **Lighthouse 12 ya no tiene la categoría PWA:** que la app sea instalable lo comprueba Playwright (manifiesto, iconos y service worker).
7. **CSP con `style-src 'unsafe-inline'`:** React (variables CSS en `style`) y Leaflet escriben estilos en línea. Los scripts quedan solo en `'self'`.
8. **Las pruebas E2E reportan en un punto al azar de la ciudad,** para no chocar con reportes vigentes de corridas anteriores (duplicados).

### Verificación
- 1209 pruebas en verde, con integración contra PostGIS; lint, typecheck, depcruise y duplicación del 0,7 %.
- Playwright local contra el build y la API local: 8 de 8.
- Lighthouse local: Performance 93 y Accesibilidad 100. JS inicial: 164 KB comprimidos.

### Pendiente
- Crear las claves VAPID de staging en Render (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`) y `FEATURE_NOTIFICATIONS=true`.
- Primera corrida de `e2e.yml` contra staging, después del merge, y el PR de cierre de la Fase 8 con las casillas del roadmap.

### Cierre en staging (2026-10-19)
Con `v2.7.1` desplegada en Render (API) y en Vercel (web).
- **Playwright contra staging** ([corrida](https://github.com/HerlanCh/PlataformaGIS/actions/runs/39180148362)): 8 de 8 en 27 s. La web de producción de Vercel contra la API de Render:
  - HU-01 y HU-02: otro navegador ve el reporte llegar en vivo;
  - HU-03: el aviso a menos de 150 m y el voto;
  - HU-05: 3 reportes sin conexión y exactamente 3 en la API al volver la señal (0 perdidos y 0 duplicados);
  - HU-06, HU-07 y HU-08;
  - que la app sea instalable y axe-core en la pantalla y las hojas.
- **Lighthouse CI** (en cada PR, sin las teselas de OSM): Performance ≥ 90 y Accesibilidad 100. El JS inicial pesa 149 KB comprimidos.
- **ZAP baseline** sobre `v2.7.1`: sin hallazgos altos.
- **CSP y cabeceras de seguridad** activas en la web de producción (`apps/web/vercel.json`).

### Incidente: la v2.7.0 no arrancó en Render
- **Qué pasó:** `tsup` empaqueta `web-push`, una librería CommonJS que usa `require("crypto")`. En el bundle ESM `require` no existe, y la API falló al cargar con `Dynamic require of "crypto" is not supported`.
  - Render mantuvo la v2.6.0, así que staging no se cayó.
  - La corrida E2E y el ZAP esperaron la versión nueva sin llegar a probar nada.
- **Por qué no se vio antes:** en desarrollo, en las pruebas y en la CI la API corre desde el código fuente con `tsx`; nada arrancaba el bundle construido.
- **Corrección (v2.7.1):** un `banner` en `apps/api/tsup.config.ts` crea `require` con `createRequire(import.meta.url)`.
- **Prevención:** la CI tiene un paso nuevo, «Arranque del bundle de la API» (`tools/arranque/api.mjs`). Arranca el bundle sin variables de entorno y exige que llegue a validar la configuración. Contra el bundle roto falla con el mismo error que Render.

### Fase 8 cerrada
Se cumplen los tres criterios de salida del roadmap: las historias del frontend aprobadas en Playwright contra staging, 0 reportes perdidos sin conexión y el presupuesto de Lighthouse.

### Pendiente para fases siguientes
- **Entrega real de un aviso push en un teléfono:** la prueba automática simula solo el servicio push del navegador. Probarlo a mano en Android e iPhone instalado.
- **Bot de Telegram:** descartado por el ADR-004 (ver la entrada «Fase 9 descartada»).

## [2026-10-19] — Incidente: el mapa en blanco desde la segunda visita

- **Qué pasó:** en la web de producción, el mapa se veía en la primera visita y quedaba en gris a partir de la segunda. Las teselas fallaban con `net::ERR_FAILED`.
- **Causa:** cuando el service worker ya controla la página, intercepta las teselas de OpenStreetMap para guardarlas en caché y las pide con `fetch()`. Esas peticiones se rigen por `connect-src` de la CSP, no por `img-src`, y `apps/web/vercel.json` no incluía `https://tile.openstreetmap.org` en `connect-src`.
- **Por qué no se vio antes:** Playwright y Lighthouse abren cada página en un contexto nuevo, donde el service worker aún no controla la página, y en desarrollo no hay CSP.
- **Corrección:** se añadió el origen de las teselas a `connect-src`. La prueba `apps/web/src/csp.test.ts` exige ese origen en `img-src` y en `connect-src`.
- **Hallazgo al verificar en producción:** la caché `teselas-osm` quedaba vacía. Leaflet pide las teselas con `<img>` sin CORS, el service worker recibe respuestas opacas (estado 0) y Workbox solo guarda las de estado 200. El mapa no se veía sin conexión. Se añadió `CacheableResponsePlugin` con los estados 0 y 200; la prueba está en `apps/web/src/services/teselas.test.ts`.

## [2026-10-19] — Fase 9 descartada: canal Telegram

### Qué se hizo
- **ADR-004** (`docs/adr/ADR-004.md`): HU-09 y RF-14 quedan fuera de alcance, RF-13 se cumple solo por Web Push y Telegraf sale del stack.
- **Documentos ajustados:**
  - `ROADMAP.md`: Fase 9 marcada como descartada, con su plan original como referencia; sin el bot en el diagrama, el stack ni la Fase 12;
  - `srs.md`: RF-14 y HU-09 marcados fuera de alcance, RF-13 solo Web Push, sin la interfaz de Telegram;
  - `trazabilidad.md`, `riesgos.md` (RSK-05 materializado y cerrado; RSK-08 sin el canal alterno), `diccionario-datos.md`, nota en el ADR-002 y `CLAUDE.md`.
- **Código:** se eliminó el esqueleto vacío de `apps/bot` y `tools/modules/sync-modules.mjs` ya no lo busca.

### Decisiones
- **Motivo:** Telegram tiene poco uso en La Paz y El Alto (riesgo RSK-05) y la PWA ya cubre HU-01 a HU-08 con avisos Web Push en staging.
- **Reversible sin migraciones:** se conservan la columna `usuarios.id_telegram` y el puerto `EnviadorDeNotificaciones`. Un canal futuro (Telegram o WhatsApp) sería un adaptador nuevo en la raíz de composición, con su propio ADR.

### Siguiente
- Fase 10: moderación, datos abiertos e IA.

## [2026-10-20] — Fase 10: moderación, datos abiertos e IA

### Qué se hizo
La fase se entregó en cinco PR, cada uno con su release:

| PR | Versión | Contenido |
| :-- | :-- | :-- |
| #36 | v2.8.0 | Descripción privada del reporte (`PATCH /v1/reportes/:id/descripcion`) y el paso «Añadir detalle» en la PWA |
| #37 | v2.9.0 | Módulo `classifier`: reglas (enlaces, spam, datos personales, frecuencia del autor, texto repetitivo y longitud anormal), clasificación asíncrona tras el outbox y `ClasificadorConRespaldo` |
| #38 | v2.10.0 | Cola de moderación, «mantener», pantalla `/moderacion` y `pnpm moderador:ascender` |
| #39 | v2.11.0 | Módulo `open-data`, portal `/datos-abiertos`, CSV con licencia CC BY 4.0 y `pnpm datos-abiertos:cargar` |
| Este | — | Exportación del conjunto etiquetado, evaluación del clasificador y cierre de la fase |

### Decisiones
- **Descripción en lugar de fotos:** los reportes no tenían texto y el clasificador lo necesita. La descripción es opcional y privada: solo la leen el clasificador y los moderadores, y las pruebas RNF-14 la tratan como campo prohibido en toda respuesta pública. No se admiten fotos, por la regla ética.
- **ADR-005:** los datos abiertos van en una tabla propia, alimentada por eventos y anonimizada al escribir, con portal en la PWA. Reemplaza la vista materializada y Metabase, que no cabe en el plan gratuito; el ADR-003 tampoco admitía otra lectura de `reportes`.
- **El rol de moderador se asigna por script** (`pnpm moderador:ascender`), sin ruta HTTP. La PWA renueva el token al abrir `/moderacion` para tomar el rol nuevo.
- **La evaluación no ajusta las reglas a la partición de prueba**, para no sesgar la comparación con el modelo de la Fase 13.

### Evaluación del clasificador
Con el conjunto sintético de 200 ejemplos, sobre la partición de prueba de 67:
- precisión del 100 %;
- exhaustividad del 73,7 %.

Los falsos negativos muestran lo que las reglas no ven:
- plurales («Préstamos»);
- texto sin sentido que no se repite;
- nombres de personas.

Ese es el caso para el modelo de IA de la Fase 13, que se adopta solo si supera esta medición con datos reales del piloto. Informe completo en `docs/clasificador/evaluacion.md`.

### Verificación
- Cada PR pasó la CI: compuertas de calidad, SonarCloud y Vercel. Las compuertas incluyen pruebas con PostGIS, cobertura, lint, typecheck, dependency-cruiser y duplicación (menor al 1,2 %).
- Se probó a mano en local, con navegador y servidor reales:
  - un reporte con «GRATIS», un enlace y un celular quedó marcado en la cola y el rechazo dejó el reporte `RECHAZADO` y su auditoría;
  - la carga del histórico de 3000 reportes sintéticos dio 2496 filas y 0 al repetirla.
- En producción (Render y Vercel) responden `/moderacion`, `/datos-abiertos`, `GET /v1/moderacion/cola` (401 sin token) y `GET /v1/datos-abiertos/resumen`.

### Pendiente
- Ejecutar una vez `pnpm datos-abiertos:cargar` contra Neon para publicar el histórico de staging. Hasta entonces, el portal solo muestra los reportes que terminen desde la v2.11.0.
- Dar el rol a la primera persona moderadora con `pnpm moderador:ascender <idUsuario>` contra Neon.
- Fase 13: modelo de IA (FastAPI y `HttpClassifier`) entrenado con `pnpm clasificador:exportar`, y evaluado con `pnpm clasificador:evaluar` sobre la misma partición.

## [2026-10-23] — Fase 11: verificación integral de calidad

### Qué se hizo
Se midió cada RNF de ISO/IEC 25010 sobre el sistema completo y se corrigieron los defectos encontrados. El alcance
estuvo congelado: solo correcciones. La fase se entregó en seis PR:

| PR | Versión | Contenido |
| :-- | :-- | :-- |
| #41 | v2.12.1 | `503` en `problem+json` con la base caída (prueba 3.1) |
| #42 | — | `pnpm fiabilidad:reinicio` y prueba Playwright de corte de red durante el envío (pruebas 3.2 y 3.3) |
| #43 | — | Respaldo diario cifrado de staging con restauración de prueba (prueba 4, RNF-07) |
| #44 | — | Escenario k6 completo, curva de capacidad, difusión con 500 clientes y consultas con 100.000 reportes (pruebas 1 y 2) |
| #45 | v2.12.2 | SSRF en el endpoint de Web Push, ZAP completo, `pnpm audit` y revisión del OWASP Top 10 (prueba 6) |
| #46 y este | — | Informe de calidad, trazabilidad, materiales de usabilidad y cierre |

### Resultados
- **13 de 14 RNF cumplen.** RNF-05 (disponibilidad) se mide durante el piloto.
- Valores destacados:
  - API: p95 de 19 ms en local con 100.000 reportes y 261 ms en staging;
  - difusión con 500 clientes: p95 de 708 ms en staging;
  - consulta espacial más lenta: p95 de 42 ms;
  - JS inicial de la PWA: 152 KB;
  - cobertura: 100 / 99,3 / 95,9 %;
  - 0 vulnerabilidades en dependencias de producción y 0 hallazgos altos en ZAP.
- **Defectos encontrados y corregidos, con prueba primero:**
  1. `500` en lugar de `503` con la base caída;
  2. SSRF ciego por el `endpoint` de Web Push;
  3. dos dependencias de desarrollo con vulnerabilidades altas.
- **Defectos críticos o altos abiertos:** 0.
- Informe completo en `docs/informe-calidad.md`.

### Decisiones
- **100.000 reportes en local, no en staging:** cargar datos sintéticos en staging ensuciaría el mapa público y los
  datos abiertos. Staging se mide con sus datos reales.
- **ZAP completo también contra la API local:** en staging, el firewall de Render bloquea con HTML 403 parte de los
  ataques de inyección antes de que lleguen a la API.
- **Límite de capacidad documentado:** con unas 170 solicitudes/s el proceso se satura por el pool de 5 conexiones
  (RSK-02), sin errores. Con unas 100 solicitudes/s el p95 es de 39 ms.
- **Usabilidad como desviación aceptada:** no hubo sesiones con personas reales en esta fase. La prueba se hará en el
  piloto (Fase 13) con el guion de `docs/usabilidad/`. No se registraron datos que no se midieron.

### Pendiente
- Prueba de usabilidad con 5 personas reales al inicio del piloto (Fase 13).
- Siguiente: Fase 12, transición a producción.

## [2026-10-24] — Fase 12: transición a producción

### Qué se hizo
El sistema quedó en producción, separado de staging, desplegado solo por el pipeline, con respaldo diario y
monitoreo. La fase se entregó en estos PR:

| PR | Versión | Contenido |
| :-- | :-- | :-- |
| #48 | — | Workflow `Produccion` con aprobación manual, servicio de producción en `render.yaml`, CSP por entorno y compuerta de migraciones compatibles |
| #51 | v2.13.0 | `pnpm humo`, usuario de humo excluido de avisos, datos abiertos y reputación, y workflow `Administracion` |
| #52 | v2.13.1 | `CORS_ORIGIN` en el paso de migraciones (el primer despliegue falló ahí, antes de tocar la base) |
| #53 | — | Respaldo diario y restauración de prueba también de producción (`produccion-respaldo`) |
| #54 | v2.14.0 | `/privacidad`, `/terminos` y `docs/runbook.md` |
| #55 | v2.15.0 | Errores a GlitchTip (`packages/errores-remotos`), claves VAPID de producción y zod 4.6.7 / undici 8.12.2 por dos avisos altos |
| este | — | Cierre de la fase |

### Entorno de producción
- **Web:** `plataforma-gis-produccion.vercel.app` (proyecto de Vercel sin repositorio conectado).
- **API:** `plataforma-gis-api-produccion.onrender.com` (Blueprint **GIS**, `autoDeploy: false`).
- **Base:** proyecto `plataforma-gis-produccion` de Neon.
- **Secretos:** en los environments `produccion` (con revisor) y `produccion-respaldo` (sin revisor).
- **Monitoreo:** UptimeRobot sobre la API y la web, y GlitchTip (proyectos `api` y `web`).

### Resultados
- **Despliegues de producción**, todos por el pipeline: v2.13.0 (primer despliegue), v2.13.1, v2.14.0, v2.13.1
  (reversión) y v2.15.0. La prueba de humo pasó 6/6 en cada uno, salvo en el primero (abajo).
- **Ensayo de reversión** siguiendo el runbook, de v2.14.0 a v2.13.1: unos 4 minutos desde la aprobación.
  - `/health` volvió al commit anterior;
  - `/privacidad` pasó a 404, porque la web también volvió a la versión anterior;
  - la prueba de humo pasó.
  - Después se volvió a desplegar la última versión.
- **Respaldo de producción:** restaurado en una base vacía con los mismos conteos (22 tablas).
- **Datos abiertos de producción:** siguen en 0 tras varias pruebas de humo, así que la exclusión funciona.
- **GlitchTip:** recibió un error enviado con el código real, con las coordenadas ya reemplazadas por
  `<coordenada>`.
- **JS inicial de la PWA:** 153,0 KB. El reporte de errores suma 0,9 KB; las pantallas legales se cargan aparte.

### Decisiones
- **Sin SDK de Sentry:** el SDK suma dependencias y peso, y mete OpenTelemetry en el bundle de la API.
  `packages/errores-remotos` habla el mismo protocolo y filtra cada campo.
- **Usuario de humo:** se rechaza su reporte en lugar de borrarlo, porque no existe una ruta para borrar. La
  exclusión vive en la raíz de composición, sin tocar módulos (ADR-001).
- **Migraciones en el pipeline y no al arrancar:** la versión anterior sigue sirviendo sobre el esquema nuevo, y
  revertir la API no exige revertir la base.
- **`produccion-respaldo`:** el respaldo diario no debe esperar la aprobación que exige el despliegue.
- **El enlace a privacidad y términos va en los créditos del mapa:** a 360 px la cabecera no admite otro botón.

### Problemas encontrados
1. **Primer despliegue (v2.13.0):** falló en «Migraciones» porque `db:migrate` exige `CORS_ORIGIN`. Se corrigió en
   el workflow (#52), con una prueba que exige las variables obligatorias del paso.
2. **Primera prueba de humo:** falló a propósito en «registro»: el usuario de humo solo puede crearse con la API
   arriba. Se preparó con `Administracion` y la siguiente versión pasó.
3. **Avisos altos publicados durante la fase** (zod y undici): la auditoría de la CI los detectó en el PR #55 y se
   corrigieron allí.
4. **Una ejecución de `Produccion` sin aprobar bloquea la siguiente** (mismo grupo de concurrencia). Quedó anotado
   en el runbook.

### Pendiente
- **Rotar las claves que se pegaron en el chat** durante la configuración: `DATABASE_URL` de Neon de producción,
  `RENDER_API_KEY` y el token de Vercel. El runbook explica cómo.
- **Cabecera del moderador a 360 px:** con el botón de moderación probablemente desborda, igual que con un ícono
  más. Es anterior a esta fase.
- **RNF-05** (disponibilidad ≥ 95 %) y la prueba de usabilidad se miden en el piloto.
- Siguiente: Fase 13, validación en piloto y mantenimiento.
