# Diccionario de datos

Esquema físico de la Plataforma GIS sobre PostgreSQL 18 + PostGIS 3.6. Se deriva del modelo de dominio de la Fase 2; el diagrama entidad-relación está en [`modelo-datos.puml`](modelo-datos.puml).

## Convenciones

- **Cada tabla tiene un módulo dueño.** Solo ese módulo la lee y la escribe, y sus migraciones viven en su carpeta `migrations/`.
- **Sin claves foráneas entre módulos** (ADR-001). Cuando una columna apunta a una tabla de otro módulo se guarda solo el identificador; en las tablas de abajo aparece como "Referencia lógica".
- **Identificadores:** UUID generados por la aplicación, no por la base de datos.
- **Fechas:** `timestamptz` (con zona horaria), siempre en UTC.
- **Coordenadas:** WGS84 (SRID 4326). En PostGIS `x` es la longitud e `y` la latitud.
- **Valores enumerados:** columnas `text` con una restricción `CHECK`, en lugar de tipos `ENUM`, para poder añadir valores con una migración simple.
- **Historial de migraciones:** una tabla por módulo en el esquema `drizzle` (`migrations_platform`, `migrations_reports`, etc.). Un módulo apagado con su interruptor `FEATURE_<MODULO>` no crea sus tablas.

## Resumen

| Tabla | Módulo dueño | Propósito |
| :--- | :--- | :--- |
| `outbox_events` | `platform` (compartido) | Eventos de integración pendientes de publicar |
| `users` | `identity` | Usuarios anónimos y su rol |
| `categories` | `reports` | Catálogo de categorías de incidentes |
| `reports` | `reports` | Reportes de incidentes y su ciclo de vida |
| `votes` | `verification` | Votos "¿Sigue ahí?" sobre los reportes |
| `reputations` | `verification` | Reputación de cada usuario |
| `zone_subscriptions` | `subscriptions` (opcional) | Zonas de interés de los usuarios |
| `moderation_actions` | `moderation` (opcional) | Auditoría de las decisiones de moderación |

## `platform` (compartido)

La migración `0000_postgis` crea la extensión `postgis`, de la que dependen todas las columnas espaciales. Estas migraciones se aplican siempre primero.

### `outbox_events`

Patrón *outbox*: el agregado y sus eventos se guardan en la misma transacción, y un proceso posterior (Fase 7) los publica.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador del evento. Si se repite, la escritura falla y la transacción completa se revierte |
| `type` | `text` | NOT NULL | Tipo y versión del evento, por ejemplo `ReportCreated.v1` |
| `payload` | `jsonb` | NOT NULL | Evento de integración completo |
| `created_at` | `timestamptz` | NOT NULL, por defecto `now()` | Momento en que ocurrió el evento |
| `published_at` | `timestamptz` | Nulo | Momento en que se publicó; nulo mientras está pendiente |

**Índices:** `outbox_events_pendientes_idx`, B-tree parcial sobre `created_at` donde `published_at IS NULL`: recorre los pendientes en orden de llegada.

## `identity`

### `users`

Usuarios anónimos. No guarda nombres, correos ni otros datos personales.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador del usuario |
| `device_hash` | `text` | NOT NULL, único | Hash anónimo del dispositivo |
| `telegram_id` | `text` | Nulo, único | Cuenta de Telegram vinculada, si la hay |
| `role` | `text` | NOT NULL, `CHECK` en (`CIUDADANO`, `MODERADOR`) | Rol del usuario |
| `created_at` | `timestamptz` | NOT NULL | Fecha de registro |

## `reports`

### `categories`

Catálogo de categorías. La migración `0001_seed_categories` carga las cinco del MVP (SRS 3.1); una prueba verifica que coincidan con el catálogo del dominio.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `code` | `text` | PK | Código de la categoría, por ejemplo `bloqueo` |
| `name` | `text` | NOT NULL | Nombre visible |
| `ttl_minutes` | `integer` | NOT NULL, `CHECK` > 0 | Vigencia inicial de un reporte de esta categoría, en minutos |
| `dedup_radius_m` | `integer` | NOT NULL, `CHECK` > 0 | Radio de deduplicación, en metros |
| `is_sensitive` | `boolean` | NOT NULL | Si es sensible, la ubicación pública se generaliza a una celda de 200 m |

**Semilla:**

| `code` | `name` | `ttl_minutes` | `dedup_radius_m` | `is_sensitive` |
| :--- | :--- | ---: | ---: | :--- |
| `bloqueo` | Bloqueo o protesta vial | 360 | 100 | No |
| `accidente` | Accidente de tránsito | 180 | 50 | No |
| `robo` | Hecho delictivo / robo | 120 | 200 | Sí |
| `infraestructura` | Derrumbe / vía dañada / fuga | 1440 | 50 | No |
| `jauria` | Jauría de perros agresivos | 120 | 150 | No |

### `reports`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador del reporte |
| `category_code` | `text` | NOT NULL, FK a `categories.code` | Categoría del incidente |
| `author_id` | `uuid` | NOT NULL. Referencia lógica a `users.id` | Autor. **Nunca se expone** en respuestas públicas |
| `status` | `text` | NOT NULL, `CHECK` en (`ACTIVO`, `CONFIRMADO`, `RESUELTO`, `CADUCADO`, `RECHAZADO`) | Estado de la máquina de estados |
| `ttl_minutes` | `integer` | NOT NULL | Vigencia base con la que se creó; las extensiones se calculan sobre ella |
| `extensions` | `integer` | NOT NULL, `CHECK` entre 0 y 2 | Extensiones de vigencia ya usadas |
| `rejection_reason` | `text` | Nulo, `CHECK` en (`MODERACION`, `AUTOR_SILENCIADO`) | Motivo del rechazo; nulo si no fue rechazado |
| `created_at` | `timestamptz` | NOT NULL | Fecha de creación |
| `expires_at` | `timestamptz` | NOT NULL | Fecha de caducidad vigente |
| `location` | `geometry(Point, 4326)` | NOT NULL | Ubicación real. **Nunca se expone** |
| `public_location` | `geometry(Point, 4326)` | NOT NULL | Ubicación que se muestra. La calcula `PrivacyPolicy` en el dominio; el repositorio la guarda sin recalcularla |
| `idempotency_key` | `text` | NOT NULL, único | Clave que genera el cliente; evita duplicados al reenviar reportes guardados sin conexión |

**Índices:**

- `reports_location_idx`: GiST sobre `location` (deduplicación y distancia para votar).
- `reports_public_location_idx`: GiST sobre `public_location` (consulta por viewport).
- `reports_vigentes_idx`: B-tree parcial sobre (`status`, `expires_at`) donde `status` es `ACTIVO` o `CONFIRMADO` (mapa y tarea de caducidad).

La columna `description` que preveía el roadmap no se crea todavía: el dominio no la modela. Se añadirá con una migración cuando el SRS fije su regla.

## `verification`

### `votes`

Un voto es inmutable: solo se inserta.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `report_id` | `uuid` | PK (compuesta). Referencia lógica a `reports.id` | Reporte votado |
| `user_id` | `uuid` | PK (compuesta). Referencia lógica a `users.id` | Votante |
| `value` | `text` | NOT NULL, `CHECK` en (`CONFIRMACION`, `NEGACION`) | Sentido del voto |
| `weight` | `numeric(3, 2)` | NOT NULL, `CHECK` entre 0 y 5 | Reputación del votante en el momento de votar |
| `created_at` | `timestamptz` | NOT NULL | Momento del voto |

La clave primaria (`report_id`, `user_id`) garantiza un solo voto por usuario y reporte, incluso si llegan dos a la vez; además sirve de índice para leer los votos de un reporte.

### `reputations`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `user_id` | `uuid` | PK. Referencia lógica a `users.id` | Usuario |
| `score` | `numeric(3, 2)` | NOT NULL, `CHECK` entre 0 y 5 | Reputación; en 0 el usuario está silenciado |
| `last_penalty_at` | `timestamptz` | Nulo | Última penalización; de ella parte el plazo de recuperación de 30 días |
| `updated_at` | `timestamptz` | NOT NULL, por defecto `now()` | Último cambio de la fila |

El repositorio devuelve `null` para un usuario sin fila; asignarle la reputación inicial (1.0) corresponde a los casos de uso de la Fase 5.

## `subscriptions` (opcional)

### `zone_subscriptions`

Una zona es inmutable: para cambiarla se elimina y se crea otra.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador de la zona |
| `user_id` | `uuid` | NOT NULL. Referencia lógica a `users.id` | Dueño de la zona |
| `center` | `geography(Point, 4326)` | NOT NULL | Centro del círculo. Es `geography` para medir distancias en metros |
| `radius_m` | `integer` | NOT NULL, `CHECK` entre 100 y 2000 | Radio en metros (SRS 3.3) |
| `categories` | `text[]` | NOT NULL, `CHECK` de al menos un elemento. Referencia lógica a `categories.code` | Categorías que el usuario quiere recibir |
| `created_at` | `timestamptz` | NOT NULL | Fecha de creación |

**Índices:**

- `zone_subscriptions_center_idx`: GiST sobre `center` (zonas que contienen un punto, Fase 4).
- `zone_subscriptions_user_idx`: B-tree sobre `user_id` (zonas de un usuario y su límite de 5).

## `moderation` (opcional)

### `moderation_actions`

Auditoría: quién decidió qué sobre qué reporte y por qué. Solo se inserta. En esta fase existe solo la tabla; su dominio y su repositorio llegan con la moderación (Fase 10).

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador de la acción |
| `report_id` | `uuid` | NOT NULL. Referencia lógica a `reports.id` | Reporte moderado |
| `moderator_id` | `uuid` | NOT NULL. Referencia lógica a `users.id` | Moderador que decidió |
| `action` | `text` | NOT NULL, `CHECK` en (`RECHAZAR`, `MANTENER`) | Decisión |
| `reason` | `text` | Nulo. `CHECK`: obligatorio y no vacío cuando la acción es `RECHAZAR` | Motivo |
| `created_at` | `timestamptz` | NOT NULL | Momento de la decisión |

**Índices:** `moderation_actions_report_idx`, B-tree sobre `report_id` (historial de un reporte).

## Migraciones

| Conjunto | Migración | Contenido |
| :--- | :--- | :--- |
| `platform` | `0000_postgis` | Extensión PostGIS |
| `platform` | `0001_outbox` | `outbox_events` y su índice |
| `identity` | `0000_users` | `users` |
| `reports` | `0000_categories_reports` | `categories`, `reports` y sus índices |
| `reports` | `0001_seed_categories` | Las cinco categorías del MVP |
| `verification` | `0000_votes_reputations` | `votes` y `reputations` |
| `subscriptions` | `0000_zone_subscriptions` | `zone_subscriptions` y sus índices |
| `moderation` | `0000_moderation_actions` | `moderation_actions` y su índice |

Cada migración tiene su reversa escrita a mano en `<nombre>.down.sql`, porque Drizzle Kit solo genera el avance. Las pruebas de integración aplican, revierten y vuelven a aplicar cada conjunto contra PostGIS real.

Dos migraciones se corrigieron a mano tras generarlas, y lo indican en su primera línea:

- `reports/0000_categories_reports`: Drizzle Kit escribe `geometry(point)` sin SRID; se fijó `geometry(Point, 4326)`.
- `subscriptions/0000_zone_subscriptions`: Drizzle Kit entrecomilla el tipo personalizado; `geography(Point, 4326)` va sin comillas.
