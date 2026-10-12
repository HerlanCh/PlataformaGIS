# Diccionario de datos

Esquema físico de la Plataforma GIS sobre PostgreSQL 18 + PostGIS 3.6. Se deriva del modelo de dominio de la Fase 2; el diagrama entidad-relación está en [`modelo-datos.puml`](modelo-datos.puml).

## Convenciones

- **Cada tabla tiene un módulo dueño.** Solo ese módulo la lee y la escribe, y sus migraciones viven en su carpeta `migrations/`.
- **Sin claves foráneas entre módulos** (ADR-001). Cuando una columna apunta a una tabla de otro módulo se guarda solo el identificador; en las tablas de abajo aparece como "Referencia lógica".
- **Identificadores:** UUID generados por la aplicación, no por la base de datos.
- **Fechas:** `timestamptz` (con zona horaria), siempre en UTC.
- **Coordenadas:** WGS84 (SRID 4326). En PostGIS `x` es la longitud e `y` la latitud.
- **Valores enumerados:** columnas `text` con una restricción `CHECK`, en lugar de tipos `ENUM`, para poder añadir valores con una migración simple.
- **Nombres en español:** las tablas y columnas se llaman en español, sin tildes ni eñes y en `snake_case`; los identificadores llevan el prefijo `id_` y las fechas terminan en `_en`. El código TypeScript conserva sus nombres en inglés: la equivalencia está en `adapters/schema.ts` de cada módulo (por ejemplo, la propiedad `expiresAt` es la columna `caduca_en`).
- **Historial de migraciones:** una tabla por módulo en el esquema `drizzle` (`migrations_platform`, `migrations_reports`, etc.). Un módulo apagado con su interruptor `FEATURE_<MODULO>` no crea sus tablas.

## Resumen

| Tabla | Módulo dueño | Propósito |
| :--- | :--- | :--- |
| `eventos_salida` | `platform` (compartido) | Eventos de integración pendientes de publicar |
| `usuarios` | `identity` | Usuarios anónimos y su rol |
| `categorias` | `reports` | Catálogo de categorías de incidentes |
| `reportes` | `reports` | Reportes de incidentes y su ciclo de vida |
| `votos` | `verification` | Votos "¿Sigue ahí?" sobre los reportes |
| `reputaciones` | `verification` | Reputación de cada usuario |
| `zonas_suscritas` | `subscriptions` (opcional) | Zonas de interés de los usuarios |
| `acciones_moderacion` | `moderation` (opcional) | Auditoría de las decisiones de moderación |

## `platform` (compartido)

La migración `0000_postgis` crea la extensión `postgis`, de la que dependen todas las columnas espaciales. Estas migraciones se aplican siempre primero.

### `eventos_salida`

Patrón *outbox*: el agregado y sus eventos se guardan en la misma transacción, y un proceso posterior (Fase 7) los publica.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador del evento. Si se repite, la escritura falla y la transacción completa se revierte |
| `tipo` | `text` | NOT NULL | Tipo y versión del evento, por ejemplo `ReportCreated.v1` |
| `contenido` | `jsonb` | NOT NULL | Evento de integración completo |
| `creado_en` | `timestamptz` | NOT NULL, por defecto `now()` | Momento en que ocurrió el evento |
| `publicado_en` | `timestamptz` | Nulo | Momento en que se publicó; nulo mientras está pendiente |

**Índices:** `eventos_salida_pendientes_idx`, B-tree parcial sobre `creado_en` donde `publicado_en IS NULL`: recorre los pendientes en orden de llegada.

## `identity`

### `usuarios`

Usuarios anónimos. No guarda nombres, correos ni otros datos personales.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador del usuario |
| `hash_dispositivo` | `text` | NOT NULL, único | Hash anónimo del dispositivo |
| `id_telegram` | `text` | Nulo, único | Cuenta de Telegram vinculada, si la hay |
| `rol` | `text` | NOT NULL, `CHECK` en (`CIUDADANO`, `MODERADOR`) | Rol del usuario |
| `creado_en` | `timestamptz` | NOT NULL | Fecha de registro |

## `reports`

### `categorias`

Catálogo de categorías. La migración `0001_semilla_categorias` carga las cinco del MVP (SRS 3.1); una prueba verifica que coincidan con el catálogo del dominio.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `codigo` | `text` | PK | Código de la categoría, por ejemplo `bloqueo` |
| `nombre` | `text` | NOT NULL | Nombre visible |
| `ttl_minutos` | `integer` | NOT NULL, `CHECK` > 0 | Vigencia inicial de un reporte de esta categoría, en minutos |
| `radio_duplicado_m` | `integer` | NOT NULL, `CHECK` > 0 | Radio de deduplicación, en metros |
| `es_sensible` | `boolean` | NOT NULL | Si es sensible, la ubicación pública se generaliza a una celda de 200 m |

**Semilla:**

| `codigo` | `nombre` | `ttl_minutos` | `radio_duplicado_m` | `es_sensible` |
| :--- | :--- | ---: | ---: | :--- |
| `bloqueo` | Bloqueo o protesta vial | 360 | 100 | No |
| `accidente` | Accidente de tránsito | 180 | 50 | No |
| `robo` | Hecho delictivo / robo | 120 | 200 | Sí |
| `infraestructura` | Derrumbe / vía dañada / fuga | 1440 | 50 | No |
| `jauria` | Jauría de perros agresivos | 120 | 150 | No |

### `reportes`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador del reporte |
| `codigo_categoria` | `text` | NOT NULL, FK a `categorias.codigo` | Categoría del incidente |
| `id_autor` | `uuid` | NOT NULL. Referencia lógica a `usuarios.id` | Autor. **Nunca se expone** en respuestas públicas |
| `estado` | `text` | NOT NULL, `CHECK` en (`ACTIVO`, `CONFIRMADO`, `RESUELTO`, `CADUCADO`, `RECHAZADO`) | Estado de la máquina de estados |
| `ttl_minutos` | `integer` | NOT NULL | Vigencia base con la que se creó; las extensiones se calculan sobre ella |
| `extensiones` | `integer` | NOT NULL, `CHECK` entre 0 y 2 | Extensiones de vigencia ya usadas |
| `motivo_rechazo` | `text` | Nulo, `CHECK` en (`MODERACION`, `AUTOR_SILENCIADO`) | Motivo del rechazo; nulo si no fue rechazado |
| `creado_en` | `timestamptz` | NOT NULL | Fecha de creación |
| `caduca_en` | `timestamptz` | NOT NULL | Fecha de caducidad vigente |
| `ubicacion` | `geometry(Point, 4326)` | NOT NULL | Ubicación real. **Nunca se expone** |
| `ubicacion_publica` | `geometry(Point, 4326)` | NOT NULL | Ubicación que se muestra. La calcula `PrivacyPolicy` en el dominio; el repositorio la guarda sin recalcularla |
| `clave_idempotencia` | `text` | NOT NULL, único | Clave que genera el cliente; evita duplicados al reenviar reportes guardados sin conexión |

**Índices:**

- `reportes_ubicacion_idx`: GiST sobre `ubicacion` (deduplicación y distancia para votar).
- `reportes_ubicacion_publica_idx`: GiST sobre `ubicacion_publica` (consulta por viewport).
- `reportes_vigentes_idx`: B-tree parcial sobre (`estado`, `caduca_en`) donde `estado` es `ACTIVO` o `CONFIRMADO` (mapa y tarea de caducidad).

La columna `description` que preveía el roadmap no se crea todavía: el dominio no la modela. Se añadirá con una migración cuando el SRS fije su regla.

## `verification`

### `votos`

Un voto es inmutable: solo se inserta.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_reporte` | `uuid` | PK (compuesta). Referencia lógica a `reportes.id` | Reporte votado |
| `id_usuario` | `uuid` | PK (compuesta). Referencia lógica a `usuarios.id` | Votante |
| `valor` | `text` | NOT NULL, `CHECK` en (`CONFIRMACION`, `NEGACION`) | Sentido del voto |
| `peso` | `numeric(3, 2)` | NOT NULL, `CHECK` entre 0 y 5 | Reputación del votante en el momento de votar |
| `creado_en` | `timestamptz` | NOT NULL | Momento del voto |

La clave primaria (`id_reporte`, `id_usuario`) garantiza un solo voto por usuario y reporte, incluso si llegan dos a la vez; además sirve de índice para leer los votos de un reporte.

### `reputaciones`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_usuario` | `uuid` | PK. Referencia lógica a `usuarios.id` | Usuario |
| `puntaje` | `numeric(3, 2)` | NOT NULL, `CHECK` entre 0 y 5 | Reputación; en 0 el usuario está silenciado |
| `ultima_penalizacion_en` | `timestamptz` | Nulo | Última penalización; de ella parte el plazo de recuperación de 30 días |
| `actualizado_en` | `timestamptz` | NOT NULL, por defecto `now()` | Último cambio de la fila |

El repositorio devuelve `null` para un usuario sin fila; asignarle la reputación inicial (1.0) corresponde a los casos de uso de la Fase 5.

## `subscriptions` (opcional)

### `zonas_suscritas`

Una zona es inmutable: para cambiarla se elimina y se crea otra.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador de la zona |
| `id_usuario` | `uuid` | NOT NULL. Referencia lógica a `usuarios.id` | Dueño de la zona |
| `centro` | `geography(Point, 4326)` | NOT NULL | Centro del círculo. Es `geography` para medir distancias en metros |
| `radio_m` | `integer` | NOT NULL, `CHECK` entre 100 y 2000 | Radio en metros (SRS 3.3) |
| `categorias` | `text[]` | NOT NULL, `CHECK` de al menos un elemento. Referencia lógica a `categorias.codigo` | Categorías que el usuario quiere recibir |
| `creado_en` | `timestamptz` | NOT NULL | Fecha de creación |

**Índices:**

- `zonas_suscritas_centro_idx`: GiST sobre `centro` (zonas que contienen un punto, Fase 4).
- `zonas_suscritas_usuario_idx`: B-tree sobre `id_usuario` (zonas de un usuario y su límite de 5).

## `moderation` (opcional)

### `acciones_moderacion`

Auditoría: quién decidió qué sobre qué reporte y por qué. Solo se inserta. En esta fase existe solo la tabla; su dominio y su repositorio llegan con la moderación (Fase 10).

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador de la acción |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte moderado |
| `id_moderador` | `uuid` | NOT NULL. Referencia lógica a `usuarios.id` | Moderador que decidió |
| `accion` | `text` | NOT NULL, `CHECK` en (`RECHAZAR`, `MANTENER`) | Decisión |
| `motivo` | `text` | Nulo. `CHECK`: obligatorio y no vacío cuando la acción es `RECHAZAR` | Motivo |
| `creado_en` | `timestamptz` | NOT NULL | Momento de la decisión |

**Índices:** `acciones_moderacion_reporte_idx`, B-tree sobre `id_reporte` (historial de un reporte).

## Migraciones

| Conjunto | Migración | Contenido |
| :--- | :--- | :--- |
| `platform` | `0000_postgis` | Extensión PostGIS |
| `platform` | `0001_eventos_salida` | `eventos_salida` y su índice |
| `identity` | `0000_usuarios` | `usuarios` |
| `reports` | `0000_categorias_reportes` | `categorias`, `reportes` y sus índices |
| `reports` | `0001_semilla_categorias` | Las cinco categorías del MVP |
| `verification` | `0000_votos_reputaciones` | `votos` y `reputaciones` |
| `subscriptions` | `0000_zonas_suscritas` | `zonas_suscritas` y sus índices |
| `moderation` | `0000_acciones_moderacion` | `acciones_moderacion` y su índice |

Cada migración tiene su reversa escrita a mano en `<nombre>.down.sql`, porque Drizzle Kit solo genera el avance. Las pruebas de integración aplican, revierten y vuelven a aplicar cada conjunto contra PostGIS real.

Dos migraciones se corrigieron a mano tras generarlas, y lo indican en su primera línea:

- `reports/0000_categorias_reportes`: Drizzle Kit escribe `geometry(point)` sin SRID; se fijó `geometry(Point, 4326)`.
- `subscriptions/0000_zonas_suscritas`: Drizzle Kit entrecomilla el tipo personalizado; `geography(Point, 4326)` va sin comillas.
