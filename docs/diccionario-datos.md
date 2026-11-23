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
| `cola_moderacion` | `moderation` (opcional) | Cola de reportes negados o marcados (HU-12) |
| `datos_abiertos_reportes` | `open-data` (opcional) | Datos abiertos anonimizados de los reportes terminados (HU-11) |
| `clasificaciones` | `classifier` (opcional) | Historial de clasificaciones de reportes (HU-10) |
| `metricas_reportes` | `metrics` (opcional) | Ciclo de vida de cada reporte para las métricas del piloto (Fase 13) |
| `metricas_actividad` | `metrics` (opcional) | Huellas de quienes actuaron en el día en curso (Fase 13) |
| `metricas_diarias` | `metrics` (opcional) | Personas activas por día, ya sin huellas (Fase 13) |

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
| `fuente_oficial` | `text` | Nulo, `CHECK` en (`TRANSITO`, `ABC`, `MI_TELEFERICO`, `OTRA`) | Fuente que cita el moderador al publicar un incidente oficial (HU-13). Nula en los reportes de la comunidad. Es pública |

**Índices:**

- `reportes_ubicacion_geography_idx`: GiST sobre `ubicacion::geography` (deduplicación, cercanía y distancia para votar: `ST_DWithin` en metros). Sustituye en la Fase 4 al índice GiST sobre `ubicacion` como `geometry`, que ninguna consulta usaba.
- `reportes_creado_en_idx`: B-tree sobre `creado_en` (los más recientes primero en la ventana del mapa y los rangos de fechas del mapa de calor). Añadido en la Fase 4.
- `reportes_autor_creado_en_idx`: B-tree sobre (`id_autor`, `creado_en`): cuántos reportes hizo un autor en la última hora, para la regla de frecuencia del clasificador. Añadido en la Fase 10.
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

Auditoría: quién decidió qué sobre qué reporte y por qué. Solo se inserta.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador de la acción |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte moderado |
| `id_moderador` | `uuid` | NOT NULL. Referencia lógica a `usuarios.id` | Moderador que decidió |
| `accion` | `text` | NOT NULL, `CHECK` en (`RECHAZAR`, `MANTENER`) | Decisión |
| `motivo` | `text` | Nulo. `CHECK`: obligatorio y no vacío cuando la acción es `RECHAZAR` | Motivo |
| `creado_en` | `timestamptz` | NOT NULL | Momento de la decisión |

**Índices:** `acciones_moderacion_reporte_idx`, B-tree sobre `id_reporte` (historial de un reporte).

### `cola_moderacion`

Cola de moderación (HU-12 y HU-10): un caso por reporte negado o marcado por el clasificador. La alimentan los eventos `VotoEmitido`, `ReporteClasificado` y los desenlaces del reporte; toda decisión de un moderador la resuelve en la misma transacción que su auditoría.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_reporte` | `uuid` | PK. Referencia lógica a `reportes.id` | Reporte en revisión |
| `negaciones` | `integer` | NOT NULL, `CHECK` ≥ 0 | Votos «Ya no está» recibidos |
| `marcado` | `boolean` | NOT NULL | El clasificador lo marcó como sospechoso |
| `motivos` | `text[]` | NOT NULL | Indicios del clasificador, sin repetir |
| `actualizado_en` | `timestamptz` | NOT NULL | Último evento que lo cambió |
| `resuelto_en` | `timestamptz` | Nulo | Cuándo salió de la cola; nulo si está pendiente |

**Índices:** `cola_moderacion_pendientes_idx`, B-tree parcial sobre (`marcado` desc, `negaciones` desc, `actualizado_en`) donde `resuelto_en IS NULL`: el orden de revisión.

## `classifier` (opcional)

### `clasificaciones`

Historial de clasificaciones (HU-10): una fila cada vez que se clasifica un reporte, al crearlo y al describirlo. Solo se inserta.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador de la clasificación |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte clasificado |
| `sospechoso` | `boolean` | NOT NULL | Si va a la cola de moderación |
| `motivos` | `text[]` | NOT NULL | Indicios detectados: `ENLACE`, `SPAM`, `DATOS_PERSONALES`, `FRECUENCIA_DEL_AUTOR`, `TEXTO_REPETITIVO`, `LONGITUD_ANORMAL` |
| `puntaje` | `real` | NOT NULL, `CHECK` entre 0 y 1 | Suma de los pesos de los indicios |
| `clasificador` | `text` | NOT NULL | Implementación que decidió (`reglas-v1`) |
| `creado_en` | `timestamptz` | NOT NULL | Momento de la clasificación |

**Índices:** `clasificaciones_reporte_idx`, B-tree sobre `id_reporte` (historial de un reporte).

## `open-data` (opcional)

### `datos_abiertos_reportes`

Una fila anonimizada por reporte terminado (HU-11, ADR-005). La llena el manejador de los desenlaces del reporte y, para el histórico, `pnpm datos-abiertos:cargar`. No tiene columnas para el autor, el punto, la descripción ni el ID: no los puede guardar.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `huella` | `text` | PK, `CHECK` SHA-256 en hexadecimal | Huella del ID del reporte: evita duplicados. Nunca se publica |
| `codigo_categoria` | `text` | NOT NULL | Categoría del reporte |
| `celda_latitud` | `double precision` | NOT NULL | Latitud del centro de la celda de 500 m (ubicación pública) |
| `celda_longitud` | `double precision` | NOT NULL | Longitud del centro de la celda |
| `hora` | `timestamptz` | NOT NULL, `CHECK` truncada a la hora (en UTC) | Hora de creación, sin minutos |
| `estado_final` | `text` | NOT NULL, `CHECK` en (`RESUELTO`, `CADUCADO`, `RECHAZADO`) | Desenlace |
| `fue_confirmado` | `boolean` | NOT NULL | La comunidad lo confirmó alguna vez |

**Índices:** `datos_abiertos_hora_idx`, B-tree sobre `hora` (orden del CSV y rango de fechas).

## `metrics` (opcional)

Métricas de uso del piloto (Fase 13). Ninguna tabla tiene columnas para el autor, los votantes, la ubicación o la
descripción: no los pueden guardar. Solo cuentan los reportes creados desde que se activa `FEATURE_METRICS`.

### `metricas_reportes`

Una fila por reporte. La llenan los eventos del reporte, con la hora del evento.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_reporte` | `uuid` | PK. Referencia lógica a `reportes.id` | Reporte |
| `codigo_categoria` | `text` | NOT NULL | Categoría |
| `es_oficial` | `boolean` | NOT NULL | Incidente de fuente oficial (HU-13): se cuenta aparte |
| `creado_en` | `timestamptz` | NOT NULL | Creación |
| `primera_confirmacion_en` | `timestamptz` | Nulo | Primer «Sigue ahí» o primer duplicado de otra persona |
| `confirmado_en` | `timestamptz` | Nulo | Paso a `CONFIRMADO` |
| `cierre` | `text` | Nulo, `CHECK` en (`CADUCIDAD`, `VOTOS`, `MODERACION`) | Cómo terminó |
| `cerrado_en` | `timestamptz` | Nulo; `CHECK` nulo si y solo si `cierre` es nulo | Cuándo terminó |

**Índices:** `metricas_reportes_creado_en_idx`, B-tree sobre `creado_en` (periodo de la consulta).

### `metricas_actividad`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `dia` | `date` | PK compuesta | Día de Bolivia |
| `huella` | `text` | PK compuesta, `CHECK` HMAC-SHA256 en hexadecimal | HMAC del día y el usuario con una sal secreta. Las de dos días distintos no se pueden relacionar |

Al empezar un día, las huellas de los anteriores se reducen a su conteo en `metricas_diarias` y se borran.

### `metricas_diarias`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `dia` | `date` | PK | Día de Bolivia |
| `usuarios_activos` | `integer` | NOT NULL, `CHECK` ≥ 0 | Personas distintas que reportaron o votaron ese día |

## `evaluation` (opcional)

Registro de los instrumentos de evaluación (Fase 13, ADR-007): lo necesario para reconstruir la vista procesada y la
vista base en cualquier instante. Ninguna tabla tiene columnas para el autor, el votante, quien reportó un duplicado
ni la ubicación real: no los pueden guardar. Solo registra desde que se activa `FEATURE_EVALUATION`. Cada fila se
escribe una sola vez (`on conflict do nothing`): un evento repetido no cuenta dos veces.

### `evaluacion_envios`

Un envío por reporte creado (`CREADO`) y uno por cada duplicado que `reports` absorbió (`DUPLICADO`).

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_envio` | `uuid` | PK | En un envío `CREADO`, el ID del reporte; en uno `DUPLICADO`, el `idEnvio` de `EnvioDuplicadoRegistrado.v1` |
| `tipo` | `text` | NOT NULL, `CHECK` en (`CREADO`, `DUPLICADO`) | Si llegó a ser reporte o se absorbió |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | El reporte creado o el que absorbió al duplicado |
| `codigo_categoria` | `text` | NOT NULL | Categoría |
| `ubicacion_publica` | `geometry(Point, 4326)` | NOT NULL | Ubicación pública: centro de la celda de 200 m en las categorías sensibles |
| `fuente_oficial` | `text` | Nulo, `CHECK` del catálogo de HU-13 | Fuente de un incidente oficial |
| `recibido_en` | `timestamptz` | NOT NULL | Cuándo llegó el envío |

**Índices:** `evaluacion_envios_ubicacion_publica_idx` (GiST, zona de la vista), `evaluacion_envios_recibido_en_idx`
(ventana de 24 h) y `evaluacion_envios_id_reporte_idx`.

### `evaluacion_transiciones`

Cada cambio de estado de un reporte, con la hora del evento. La creación es la primera; una extensión deja
`CONFIRMADO` con otra caducidad.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_evento` | `uuid` | PK | Evento de integración que la produjo |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte |
| `estado` | `text` | NOT NULL, `CHECK` de los cinco estados | Estado que deja |
| `caduca_en` | `timestamptz` | Nulo si y solo si el estado es final (`CHECK`) | Caducidad que deja |
| `ocurrido_en` | `timestamptz` | NOT NULL | Hora del evento |

**Índices:** `evaluacion_transiciones_reporte_idx`, B-tree sobre (`id_reporte`, `ocurrido_en`).

### `evaluacion_votos`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_evento` | `uuid` | PK | `VotoEmitido.v1` que lo registró |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte votado |
| `valor` | `text` | NOT NULL, `CHECK` en (`CONFIRMACION`, `NEGACION`) | Sentido del voto |
| `peso` | `double precision` | NOT NULL, `CHECK` entre 0 y 5 | Reputación con la que contó |
| `decision` | `text` | NOT NULL, `CHECK` en (`NINGUNA`, `CONFIRMAR`, `EXTENDER`, `RESOLVER`) | Lo que pidió aplicar |
| `ocurrido_en` | `timestamptz` | NOT NULL | Hora del voto |

**Índices:** `evaluacion_votos_reporte_idx`, B-tree sobre (`id_reporte`, `ocurrido_en`).

### `evaluacion_instantaneas`

Una zona en un instante, congelada por un moderador (escenarios E1 y E2). Un disparador
(`evaluacion_instantanea_inmutable`) rechaza todo `UPDATE` o `DELETE` en esta tabla y en la de sus puntos.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Instantánea |
| `nombre` | `text` | NOT NULL, UNIQUE, `CHECK` de 1 a 40 caracteres | `E1`, `E2`... |
| `instante` | `timestamptz` | NOT NULL | Instante reconstruido |
| `latitud_min`, `latitud_max`, `longitud_min`, `longitud_max` | `double precision` | NOT NULL, `CHECK` mínimo < máximo | Zona |
| `creada_en` | `timestamptz` | NOT NULL | Cuándo se congeló |

### `evaluacion_puntos_instantanea`

Los puntos de ambas vistas de una instantánea. La clave foránea a `evaluacion_instantaneas` es interna del módulo.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_instantanea` | `uuid` | PK compuesta, FK a `evaluacion_instantaneas.id` | Instantánea |
| `vista` | `text` | PK compuesta, `CHECK` en (`PROCESADA`, `BASE`) | Vista del punto |
| `id_punto` | `uuid` | PK compuesta | El reporte (procesada) o el envío (base) |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte del punto |
| `codigo_categoria` | `text` | NOT NULL | Categoría |
| `ubicacion_publica` | `geometry(Point, 4326)` | NOT NULL | Ubicación pública |
| `estado` | `text` | Solo en la procesada (`ACTIVO` o `CONFIRMADO`) | Estado en el instante |
| `caduca_en` | `timestamptz` | Solo en la procesada | Caducidad en el instante |
| `recibido_en` | `timestamptz` | Solo en la base | Hora del envío |
| `fuente_oficial` | `text` | Nulo | Fuente de un incidente oficial |

Un `CHECK` (`evaluacion_puntos_campos_check`) exige los campos de cada vista y prohíbe los de la otra.

### `evaluacion_sesiones`

Sesión de la tarea cronometrada de un participante. Sin nombre ni dato personal: solo un código anónimo.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Sesión |
| `codigo_participante` | `text` | NOT NULL, UNIQUE, `CHECK` `^P[0-9]{2,3}# Diccionario de datos

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
| `cola_moderacion` | `moderation` (opcional) | Cola de reportes negados o marcados (HU-12) |
| `datos_abiertos_reportes` | `open-data` (opcional) | Datos abiertos anonimizados de los reportes terminados (HU-11) |
| `clasificaciones` | `classifier` (opcional) | Historial de clasificaciones de reportes (HU-10) |
| `metricas_reportes` | `metrics` (opcional) | Ciclo de vida de cada reporte para las métricas del piloto (Fase 13) |
| `metricas_actividad` | `metrics` (opcional) | Huellas de quienes actuaron en el día en curso (Fase 13) |
| `metricas_diarias` | `metrics` (opcional) | Personas activas por día, ya sin huellas (Fase 13) |

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
| `fuente_oficial` | `text` | Nulo, `CHECK` en (`TRANSITO`, `ABC`, `MI_TELEFERICO`, `OTRA`) | Fuente que cita el moderador al publicar un incidente oficial (HU-13). Nula en los reportes de la comunidad. Es pública |

**Índices:**

- `reportes_ubicacion_geography_idx`: GiST sobre `ubicacion::geography` (deduplicación, cercanía y distancia para votar: `ST_DWithin` en metros). Sustituye en la Fase 4 al índice GiST sobre `ubicacion` como `geometry`, que ninguna consulta usaba.
- `reportes_creado_en_idx`: B-tree sobre `creado_en` (los más recientes primero en la ventana del mapa y los rangos de fechas del mapa de calor). Añadido en la Fase 4.
- `reportes_autor_creado_en_idx`: B-tree sobre (`id_autor`, `creado_en`): cuántos reportes hizo un autor en la última hora, para la regla de frecuencia del clasificador. Añadido en la Fase 10.
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

Auditoría: quién decidió qué sobre qué reporte y por qué. Solo se inserta.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador de la acción |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte moderado |
| `id_moderador` | `uuid` | NOT NULL. Referencia lógica a `usuarios.id` | Moderador que decidió |
| `accion` | `text` | NOT NULL, `CHECK` en (`RECHAZAR`, `MANTENER`) | Decisión |
| `motivo` | `text` | Nulo. `CHECK`: obligatorio y no vacío cuando la acción es `RECHAZAR` | Motivo |
| `creado_en` | `timestamptz` | NOT NULL | Momento de la decisión |

**Índices:** `acciones_moderacion_reporte_idx`, B-tree sobre `id_reporte` (historial de un reporte).

### `cola_moderacion`

Cola de moderación (HU-12 y HU-10): un caso por reporte negado o marcado por el clasificador. La alimentan los eventos `VotoEmitido`, `ReporteClasificado` y los desenlaces del reporte; toda decisión de un moderador la resuelve en la misma transacción que su auditoría.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_reporte` | `uuid` | PK. Referencia lógica a `reportes.id` | Reporte en revisión |
| `negaciones` | `integer` | NOT NULL, `CHECK` ≥ 0 | Votos «Ya no está» recibidos |
| `marcado` | `boolean` | NOT NULL | El clasificador lo marcó como sospechoso |
| `motivos` | `text[]` | NOT NULL | Indicios del clasificador, sin repetir |
| `actualizado_en` | `timestamptz` | NOT NULL | Último evento que lo cambió |
| `resuelto_en` | `timestamptz` | Nulo | Cuándo salió de la cola; nulo si está pendiente |

**Índices:** `cola_moderacion_pendientes_idx`, B-tree parcial sobre (`marcado` desc, `negaciones` desc, `actualizado_en`) donde `resuelto_en IS NULL`: el orden de revisión.

## `classifier` (opcional)

### `clasificaciones`

Historial de clasificaciones (HU-10): una fila cada vez que se clasifica un reporte, al crearlo y al describirlo. Solo se inserta.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Identificador de la clasificación |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte clasificado |
| `sospechoso` | `boolean` | NOT NULL | Si va a la cola de moderación |
| `motivos` | `text[]` | NOT NULL | Indicios detectados: `ENLACE`, `SPAM`, `DATOS_PERSONALES`, `FRECUENCIA_DEL_AUTOR`, `TEXTO_REPETITIVO`, `LONGITUD_ANORMAL` |
| `puntaje` | `real` | NOT NULL, `CHECK` entre 0 y 1 | Suma de los pesos de los indicios |
| `clasificador` | `text` | NOT NULL | Implementación que decidió (`reglas-v1`) |
| `creado_en` | `timestamptz` | NOT NULL | Momento de la clasificación |

**Índices:** `clasificaciones_reporte_idx`, B-tree sobre `id_reporte` (historial de un reporte).

## `open-data` (opcional)

### `datos_abiertos_reportes`

Una fila anonimizada por reporte terminado (HU-11, ADR-005). La llena el manejador de los desenlaces del reporte y, para el histórico, `pnpm datos-abiertos:cargar`. No tiene columnas para el autor, el punto, la descripción ni el ID: no los puede guardar.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `huella` | `text` | PK, `CHECK` SHA-256 en hexadecimal | Huella del ID del reporte: evita duplicados. Nunca se publica |
| `codigo_categoria` | `text` | NOT NULL | Categoría del reporte |
| `celda_latitud` | `double precision` | NOT NULL | Latitud del centro de la celda de 500 m (ubicación pública) |
| `celda_longitud` | `double precision` | NOT NULL | Longitud del centro de la celda |
| `hora` | `timestamptz` | NOT NULL, `CHECK` truncada a la hora (en UTC) | Hora de creación, sin minutos |
| `estado_final` | `text` | NOT NULL, `CHECK` en (`RESUELTO`, `CADUCADO`, `RECHAZADO`) | Desenlace |
| `fue_confirmado` | `boolean` | NOT NULL | La comunidad lo confirmó alguna vez |

**Índices:** `datos_abiertos_hora_idx`, B-tree sobre `hora` (orden del CSV y rango de fechas).

## `metrics` (opcional)

Métricas de uso del piloto (Fase 13). Ninguna tabla tiene columnas para el autor, los votantes, la ubicación o la
descripción: no los pueden guardar. Solo cuentan los reportes creados desde que se activa `FEATURE_METRICS`.

### `metricas_reportes`

Una fila por reporte. La llenan los eventos del reporte, con la hora del evento.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_reporte` | `uuid` | PK. Referencia lógica a `reportes.id` | Reporte |
| `codigo_categoria` | `text` | NOT NULL | Categoría |
| `es_oficial` | `boolean` | NOT NULL | Incidente de fuente oficial (HU-13): se cuenta aparte |
| `creado_en` | `timestamptz` | NOT NULL | Creación |
| `primera_confirmacion_en` | `timestamptz` | Nulo | Primer «Sigue ahí» o primer duplicado de otra persona |
| `confirmado_en` | `timestamptz` | Nulo | Paso a `CONFIRMADO` |
| `cierre` | `text` | Nulo, `CHECK` en (`CADUCIDAD`, `VOTOS`, `MODERACION`) | Cómo terminó |
| `cerrado_en` | `timestamptz` | Nulo; `CHECK` nulo si y solo si `cierre` es nulo | Cuándo terminó |

**Índices:** `metricas_reportes_creado_en_idx`, B-tree sobre `creado_en` (periodo de la consulta).

### `metricas_actividad`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `dia` | `date` | PK compuesta | Día de Bolivia |
| `huella` | `text` | PK compuesta, `CHECK` HMAC-SHA256 en hexadecimal | HMAC del día y el usuario con una sal secreta. Las de dos días distintos no se pueden relacionar |

Al empezar un día, las huellas de los anteriores se reducen a su conteo en `metricas_diarias` y se borran.

### `metricas_diarias`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `dia` | `date` | PK | Día de Bolivia |
| `usuarios_activos` | `integer` | NOT NULL, `CHECK` ≥ 0 | Personas distintas que reportaron o votaron ese día |

## `evaluation` (opcional)

Registro de los instrumentos de evaluación (Fase 13, ADR-007): lo necesario para reconstruir la vista procesada y la
vista base en cualquier instante. Ninguna tabla tiene columnas para el autor, el votante, quien reportó un duplicado
ni la ubicación real: no los pueden guardar. Solo registra desde que se activa `FEATURE_EVALUATION`. Cada fila se
escribe una sola vez (`on conflict do nothing`): un evento repetido no cuenta dos veces.

### `evaluacion_envios`

Un envío por reporte creado (`CREADO`) y uno por cada duplicado que `reports` absorbió (`DUPLICADO`).

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_envio` | `uuid` | PK | En un envío `CREADO`, el ID del reporte; en uno `DUPLICADO`, el `idEnvio` de `EnvioDuplicadoRegistrado.v1` |
| `tipo` | `text` | NOT NULL, `CHECK` en (`CREADO`, `DUPLICADO`) | Si llegó a ser reporte o se absorbió |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | El reporte creado o el que absorbió al duplicado |
| `codigo_categoria` | `text` | NOT NULL | Categoría |
| `ubicacion_publica` | `geometry(Point, 4326)` | NOT NULL | Ubicación pública: centro de la celda de 200 m en las categorías sensibles |
| `fuente_oficial` | `text` | Nulo, `CHECK` del catálogo de HU-13 | Fuente de un incidente oficial |
| `recibido_en` | `timestamptz` | NOT NULL | Cuándo llegó el envío |

**Índices:** `evaluacion_envios_ubicacion_publica_idx` (GiST, zona de la vista), `evaluacion_envios_recibido_en_idx`
(ventana de 24 h) y `evaluacion_envios_id_reporte_idx`.

### `evaluacion_transiciones`

Cada cambio de estado de un reporte, con la hora del evento. La creación es la primera; una extensión deja
`CONFIRMADO` con otra caducidad.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_evento` | `uuid` | PK | Evento de integración que la produjo |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte |
| `estado` | `text` | NOT NULL, `CHECK` de los cinco estados | Estado que deja |
| `caduca_en` | `timestamptz` | Nulo si y solo si el estado es final (`CHECK`) | Caducidad que deja |
| `ocurrido_en` | `timestamptz` | NOT NULL | Hora del evento |

**Índices:** `evaluacion_transiciones_reporte_idx`, B-tree sobre (`id_reporte`, `ocurrido_en`).

### `evaluacion_votos`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_evento` | `uuid` | PK | `VotoEmitido.v1` que lo registró |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte votado |
| `valor` | `text` | NOT NULL, `CHECK` en (`CONFIRMACION`, `NEGACION`) | Sentido del voto |
| `peso` | `double precision` | NOT NULL, `CHECK` entre 0 y 5 | Reputación con la que contó |
| `decision` | `text` | NOT NULL, `CHECK` en (`NINGUNA`, `CONFIRMAR`, `EXTENDER`, `RESOLVER`) | Lo que pidió aplicar |
| `ocurrido_en` | `timestamptz` | NOT NULL | Hora del voto |

**Índices:** `evaluacion_votos_reporte_idx`, B-tree sobre (`id_reporte`, `ocurrido_en`).

### `evaluacion_instantaneas`

Una zona en un instante, congelada por un moderador (escenarios E1 y E2). Un disparador
(`evaluacion_instantanea_inmutable`) rechaza todo `UPDATE` o `DELETE` en esta tabla y en la de sus puntos.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Instantánea |
| `nombre` | `text` | NOT NULL, UNIQUE, `CHECK` de 1 a 40 caracteres | `E1`, `E2`... |
| `instante` | `timestamptz` | NOT NULL | Instante reconstruido |
| `latitud_min`, `latitud_max`, `longitud_min`, `longitud_max` | `double precision` | NOT NULL, `CHECK` mínimo < máximo | Zona |
| `creada_en` | `timestamptz` | NOT NULL | Cuándo se congeló |

### `evaluacion_puntos_instantanea`

Los puntos de ambas vistas de una instantánea. La clave foránea a `evaluacion_instantaneas` es interna del módulo.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_instantanea` | `uuid` | PK compuesta, FK a `evaluacion_instantaneas.id` | Instantánea |
| `vista` | `text` | PK compuesta, `CHECK` en (`PROCESADA`, `BASE`) | Vista del punto |
| `id_punto` | `uuid` | PK compuesta | El reporte (procesada) o el envío (base) |
| `id_reporte` | `uuid` | NOT NULL. Referencia lógica a `reportes.id` | Reporte del punto |
| `codigo_categoria` | `text` | NOT NULL | Categoría |
| `ubicacion_publica` | `geometry(Point, 4326)` | NOT NULL | Ubicación pública |
| `estado` | `text` | Solo en la procesada (`ACTIVO` o `CONFIRMADO`) | Estado en el instante |
| `caduca_en` | `timestamptz` | Solo en la procesada | Caducidad en el instante |
| `recibido_en` | `timestamptz` | Solo en la base | Hora del envío |
| `fuente_oficial` | `text` | Nulo | Fuente de un incidente oficial |

 | `P07`: nunca un nombre |
| `secuencia` | `integer` | NOT NULL, `CHECK` de 1 a 4 | Secuencia contrabalanceada (vista y escenario de cada tarea) |
| `creada_en` | `timestamptz` | NOT NULL | Apertura |

### `evaluacion_tareas`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Tarea |
| `id_sesion` | `uuid` | NOT NULL, FK a `evaluacion_sesiones.id`; UNIQUE con `orden` | Sesión |
| `orden` | `integer` | NOT NULL, `CHECK` en (1, 2) | Primera o segunda |
| `vista` | `text` | NOT NULL, `CHECK` en (`PROCESADA`, `BASE`) | Vista que ve el participante |
| `escenario` | `text` | NOT NULL, `CHECK` en (`E1`, `E2`) | Escenario |
| `id_instantanea` | `uuid` | NOT NULL, FK a `evaluacion_instantaneas.id` | Instantánea del escenario |
| `iniciada_en` | `timestamptz` | Nulo hasta empezar | Inicio, fijado por el servidor |
| `terminada_en` | `timestamptz` | Nulo hasta terminar | Cierre |
| `duracion_ms` | `integer` | Nulo hasta terminar, `CHECK` de 0 a 180000 | Tiempo usado, con el límite de 180 s |
| `agotada` | `boolean` | Nulo hasta terminar | Si se acabó el tiempo |

Un `CHECK` (`evaluacion_tareas_cierre_check`) exige que el cierre traiga duración y agotamiento, y que no haya
cierre sin inicio.

### `evaluacion_marcas`

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_tarea` | `uuid` | PK compuesta, FK a `evaluacion_tareas.id` | Tarea |
| `id_punto` | `uuid` | PK compuesta | Reporte (vista procesada) o envío (vista base) marcado |
| `ms_desde_inicio` | `integer` | NOT NULL, `CHECK` de 0 a 180000 | Momento de la marca |

### `evaluacion_etiquetas`

Etiquetado ciego: cada evaluador agrupa los envíos en incidentes reales. Sin id de usuario.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `evaluador` | `text` | PK compuesta, `CHECK` en (`A`, `B`, `CONSENSO`) | Quién etiqueta |
| `id_envio` | `uuid` | PK compuesta, FK a `evaluacion_envios.id_envio` | Envío |
| `grupo` | `text` | NOT NULL, `CHECK` de 1 a 40 caracteres | Incidente real al que pertenece |

### `evaluacion_verificaciones`

Referencia independiente de veracidad y hora de fin, comprobada en campo o con fuentes secundarias.

| Columna | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id_reporte` | `uuid` | PK. Referencia lógica a `reportes.id` | Reporte verificado |
| `resultado` | `text` | NOT NULL, `CHECK` en (`REAL`, `FALSO`, `NO_VERIFICABLE`) | Qué fue |
| `fin_en` | `timestamptz` | Nulo; solo si es `REAL` (`CHECK`) | Cuándo dejó de ser cierto |
| `fuente` | `text` | NOT NULL, `CHECK` en (`CAMPO`, `SECUNDARIA`) | Cómo se comprobó |
| `detalle_fuente` | `text` | Nulo, `CHECK` de hasta 200 caracteres | Detalle breve, nunca de personas |
| `registrada_en` | `timestamptz` | NOT NULL | Última corrección |

## Migraciones

| Conjunto | Migración | Contenido |
| :--- | :--- | :--- |
| `platform` | `0000_postgis` | Extensión PostGIS |
| `platform` | `0001_eventos_salida` | `eventos_salida` y su índice |
| `identity` | `0000_usuarios` | `usuarios` |
| `reports` | `0000_categorias_reportes` | `categorias`, `reportes` y sus índices |
| `reports` | `0001_semilla_categorias` | Las cinco categorías del MVP |
| `reports` | `0002_indices_de_consulta` | Índices `reportes_ubicacion_geography_idx` y `reportes_creado_en_idx`; elimina `reportes_ubicacion_idx` |
| `reports` | `0003_descripcion_reporte` | Columna `descripcion` y su `CHECK` |
| `reports` | `0004_indice_autor` | Índice `reportes_autor_creado_en_idx` |
| `reports` | `0005_fuente_oficial` | Columna `fuente_oficial` y su `CHECK` (HU-13) |
| `verification` | `0000_votos_reputaciones` | `votos` y `reputaciones` |
| `subscriptions` | `0000_zonas_suscritas` | `zonas_suscritas` y sus índices |
| `notifications` | `0000_suscripciones_push` | `suscripciones_push` y su índice |
| `moderation` | `0000_acciones_moderacion` | `acciones_moderacion` y su índice |
| `moderation` | `0001_cola_moderacion` | `cola_moderacion` y su índice |
| `classifier` | `0000_clasificaciones` | `clasificaciones` y su índice |
| `open-data` | `0000_datos_abiertos` | `datos_abiertos_reportes` y su índice |
| `metrics` | `0000_metricas_piloto` | `metricas_reportes`, `metricas_actividad`, `metricas_diarias` (Fase 13) |
| `evaluation` | `0000_registro_evaluacion` | `evaluacion_envios`, `evaluacion_transiciones`, `evaluacion_votos` y sus índices (ADR-007) |
| `evaluation` | `0001_instantaneas` | `evaluacion_instantaneas`, `evaluacion_puntos_instantanea` y el disparador que las hace inmutables |
| `evaluation` | `0002_herramientas` | `evaluacion_sesiones`, `evaluacion_tareas`, `evaluacion_marcas`, `evaluacion_etiquetas` y `evaluacion_verificaciones` |

Cada migración tiene su reversa escrita a mano en `<nombre>.down.sql`, porque Drizzle Kit solo genera el avance. Las pruebas de integración aplican, revierten y vuelven a aplicar cada conjunto contra PostGIS real.

Cuatro migraciones se corrigieron a mano tras generarlas, y lo indican en su primera línea:

- `reports/0000_categorias_reportes`, `evaluation/0000_registro_evaluacion` y `evaluation/0001_instantaneas`:
  Drizzle Kit escribe `geometry(point)` sin SRID; se fijó `geometry(Point, 4326)`. La última agrega a mano el
  disparador de inmutabilidad.
- `subscriptions/0000_zonas_suscritas`: Drizzle Kit entrecomilla el tipo personalizado; `geography(Point, 4326)` va sin comillas.
