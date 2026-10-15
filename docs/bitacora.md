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
