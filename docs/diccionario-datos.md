# Diccionario de datos

Esquema físico de la Plataforma GIS sobre PostgreSQL 18 + PostGIS 3.6. Se deriva del modelo de dominio de la Fase 2; el diagrama entidad-relación está en [`modelo-datos.puml`](modelo-datos.puml).

## Convenciones

- **Cada tabla tiene un módulo dueño.** Solo ese módulo la lee y la escribe, y sus migraciones viven en su carpeta `migrations/`.
- **Sin claves foráneas entre módulos** (ADR-001). Cuando una columna apunta a una tabla de otro módulo se guarda solo el identificador; en las tablas de abajo aparece como "Referencia lógica".
- **Identificadores:** UUID generados por la aplicación, no por la base de datos.
- **Fechas:** `timestamptz` (con zona horaria), siempre en UTC.
- **Coordenadas:** WGS84 (SRID 4326). En PostGIS `x` es la longitud e `y` la latitud.
- **Valores enumerados:** columnas `text` con una restricción `CHECK`, en lugar de tipos `ENUM`, para poder añadir valores con una migración simple.
- **Nombres en español:** las tablas y columnas se llaman en español, sin tildes ni eñes y en `snake_case`; los identificadores llevan el prefijo `id_` y las fechas terminan en `_en`. El código TypeScript también está en español: la equivalencia entre propiedad y columna está en `adapters/schema.ts` de cada módulo (por ejemplo, la propiedad `caducaEn` es la columna `caduca_en`).
- **Historial de migraciones:** una tabla por módulo en el esquema `drizzle` (`migrations_platform`, `migrations_reports`, etc.). Un módulo apagado con su interruptor `FEATURE_<MODULO>` no crea sus tablas.

## Resumen

| Tabla | Módulo dueño | Propósito |
| :--- | :--- | :--- |
| `eventos_salida` | `platform` (compartido) | Eventos de integración pendientes de publicar |
| `eventos_procesados` | `platform` (compartido) | Qué manejador ya procesó qué evento (bandeja de entrada) |
| `usuarios` | `identity` | Usuarios anónimos y su rol |
| `categorias` | `reports` | Catálogo de categorías de incidentes |
| `reportes` | `reports` | Reportes de incidentes y su ciclo de vida |
| `votos` | `verification` | Votos "¿Sigue ahí?" sobre los reportes |
| `reputaciones` | `verification` | Reputación de cada usuario |
| `zonas_suscritas` | `subscriptions` (opcional) | Zonas de interés de los usuarios |
| `suscripciones_push` | `notifications` (opcional) | Dispositivos que reciben avisos Web Push |
| `acciones_moderacion` | `moderation` (opcional) | Auditoría de las decisiones de moderación |

## `platform` (compartido)

La migración `0000_postgis` crea la extensión `postgis`, de la que dependen todas las columnas espaciales. Estas migraciones se aplican siempre primero.

### `eventos_salida`

Patrón *outbox*: el agregado y sus eventos se guardan en la misma transacción, y el `DespachadorDeSalida` (Fase 7) los entrega al menos una vez a sus manejadores y a Socket.io.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador del evento. Si se repite, la escritura falla y la transacción completa se revierte |
| `tipo` | `text` | NOT NULL | Tipo y versión del evento, por ejemplo `ReporteCreado.v1` |
| `contenido` | `jsonb` | NOT NULL | Evento de integración completo |
| `creado_en` | `timestamptz` | NOT NULL, por defecto `now()` | Momento en que ocurrió el evento |
| `publicado_en` | `timestamptz` | Nulo | Momento en que se publicó; nulo mientras está pendiente |
| `intentos` | `integer` | NOT NULL, por defecto 0 | Entregas fallidas (migración `0002`). Con 10, el evento se descarta y queda su error |
| `ultimo_error` | `text` | Nulo | Manejador y mensaje del último fallo |
| `proximo_intento` | `timestamptz` | Nulo | No se reintenta antes de este momento: espera de 2^intentos segundos, hasta 5 minutos |

**Índices:** `eventos_salida_pendientes_idx`, B-tree parcial sobre `creado_en` donde `publicado_en IS NULL`: recorre los pendientes en orden de llegada.

**Quién escribe en el outbox (Fase 5):** `UnidadDeTrabajoReportePg` (`reports`), `UnidadDeTrabajoVotoPg` (`verification`) y `UnidadDeTrabajoModeracionPg` (`moderation`), cada una en la misma transacción que sus tablas. Los valores de `tipo` posibles son los del catálogo `eventosDeIntegracion` de `packages/contracts`; en la Fase 5 se sumaron `ReporteExtendido.v1` (público: `idReporte`, `caducaEn`) y `RechazoDeModeracion.v1` (interno: `idReporte`, `idModerador`).

### `eventos_procesados`

Bandeja de entrada (migración `0002_entrega_de_eventos`): el despachador registra aquí cada entrega exitosa y no vuelve a pasar un evento a un manejador que ya lo procesó, aunque el evento se reintente por el fallo de otro.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_evento` | `uuid` | PK (con `manejador`) | Evento de `eventos_salida` (sin clave foránea: la tabla puede purgarse aparte) |
| `manejador` | `text` | PK (con `id_evento`) | Nombre estable del manejador, como `verification.ajustar-reputacion` |
| `procesado_en` | `timestamptz` | NOT NULL, por defecto `now()` | Momento de la entrega |

## `identity`

### `usuarios`

Usuarios anónimos. No guarda nombres, correos ni otros datos personales.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador del usuario |
| `hash_dispositivo` | `text` | NOT NULL, único | Hash anónimo del dispositivo |
| `id_telegram` | `text` | Nulo, único | Sin uso desde el ADR-004 (canal Telegram descartado); se conserva para un canal futuro sin migraciones |
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
| `ubicacion_publica` | `geometry(Point, 4326)` | NOT NULL | Ubicación que se muestra. La calcula `PoliticaDePrivacidad` en el dominio; el repositorio la guarda sin recalcularla |
| `clave_idempotencia` | `text` | NOT NULL, único | Clave que genera el cliente; evita duplicados al reenviar reportes guardados sin conexión |
| `descripcion` | `text` | Nulo, `CHECK` de 1 a 280 caracteres (`char_length`) | Detalle opcional del autor (HU-10). **Privado:** solo lo leen el clasificador y los moderadores; nunca sale en respuestas ni eventos públicos |

**Índices:**

- `reportes_ubicacion_geography_idx`: GiST sobre `ubicacion::geography` (deduplicación, cercanía y distancia para votar: `ST_DWithin` en metros). Sustituye en la Fase 4 al índice GiST sobre `ubicacion` como `geometry`, que ninguna consulta usaba.
- `reportes_creado_en_idx`: B-tree sobre `creado_en` (los más recientes primero en la ventana del mapa y los rangos de fechas del mapa de calor). Añadido en la Fase 4.
- `reportes_ubicacion_publica_idx`: GiST sobre `ubicacion_publica` (consulta por ventana del mapa y mapa de calor).
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

- `zonas_suscritas_centro_idx`: GiST sobre `centro` (zonas que contienen un punto: `buscarSuscriptores`).
- `zonas_suscritas_usuario_idx`: B-tree sobre `id_usuario` (zonas de un usuario y su límite de 5).

## `notifications` (opcional)

### `suscripciones_push`

A dónde enviar los avisos Web Push de un usuario (HU-08): una fila por dispositivo. Si el navegador vuelve a enviar el mismo `endpoint`, la fila se reemplaza y pasa al usuario actual. Un 404 o 410 del servicio push la borra.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador de la suscripción |
| `id_usuario` | `uuid` | NOT NULL. Referencia lógica a `usuarios.id` | Usuario que recibe los avisos |
| `endpoint` | `text` | NOT NULL, UNIQUE | URL https del servicio push del navegador; identifica al dispositivo |
| `p256dh` | `text` | NOT NULL | Clave pública del navegador para cifrar el aviso |
| `auth` | `text` | NOT NULL | Secreto de autenticación del navegador |
| `creado_en` | `timestamptz` | NOT NULL | Fecha del alta o de su última renovación |

**Índices:** `suscripciones_push_usuario_idx`, B-tree sobre `id_usuario` (dispositivos de un usuario al enviar un aviso).

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
| `reports` | `0002_indices_de_consulta` | Índices `reportes_ubicacion_geography_idx` y `reportes_creado_en_idx`; elimina `reportes_ubicacion_idx` |
| `verification` | `0000_votos_reputaciones` | `votos` y `reputaciones` |
| `subscriptions` | `0000_zonas_suscritas` | `zonas_suscritas` y sus índices |
| `notifications` | `0000_suscripciones_push` | `suscripciones_push` y su índice |
| `moderation` | `0000_acciones_moderacion` | `acciones_moderacion` y su índice |

Cada migración tiene su reversa escrita a mano en `<nombre>.down.sql`, porque Drizzle Kit solo genera el avance. Las pruebas de integración aplican, revierten y vuelven a aplicar cada conjunto contra PostGIS real.

Dos migraciones se corrigieron a mano tras generarlas, y lo indican en su primera línea:

- `reports/0000_categorias_reportes`: Drizzle Kit escribe `geometry(point)` sin SRID; se fijó `geometry(Point, 4326)`.
- `subscriptions/0000_zonas_suscritas`: Drizzle Kit entrecomilla el tipo personalizado; `geography(Point, 4326)` va sin comillas.
