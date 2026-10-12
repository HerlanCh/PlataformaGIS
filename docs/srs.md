# Especificación de Requisitos de Software (SRS)

**Estándar:** ISO/IEC/IEEE 29148:2018  
**Proyecto:** Plataforma GIS de alerta temprana — La Paz y El Alto  
**Versión:** 1.1.0 — Fase 0 (corregida)  
**Fecha:** 2026-10-11  

---

## 1. Introducción

### 1.1 Propósito
El presente documento describe la especificación formal de requisitos funcionales y no funcionales de la **Plataforma GIS de alerta temprana**, una aplicación web progresiva (PWA) comunitaria diseñada para registrar, verificar y difundir incidentes urbanos georreferenciados en tiempo real (bloqueos, accidentes, robos, infraestructura crítica y jaurías) en las ciudades de La Paz y El Alto (Bolivia).

### 1.2 Alcance del Sistema
El sistema proporciona:
- Reporte rápido en dos toques con geolocalización automática del dispositivo.
- Visualización cartográfica interactiva y en tiempo real sobre OpenStreetMap.
- Mecanismo comunitario de verificación de incidentes ("¿Sigue ahí?").
- Deduplicación espacial y caducidad temporal automática por categoría.
- Operación resiliente en modo fuera de línea con sincronización automática e idempotente.
- Visualización agregada mediante mapa de calor.
- Alertas para zonas de interés mediante Web Push y Bot de Telegram.

Queda fuera del alcance: rutas alternas, botón de pánico, y cualquier función de despacho de emergencias. La plataforma no reemplaza a las líneas de emergencia.

### 1.3 Límites Geográficos del Dominio
El sistema opera dentro del rectángulo envolvente (*Bounding Box*) de la conurbación La Paz – El Alto:
- **Latitud:** [-16.6700, -16.3800]
- **Longitud:** [-68.3300, -68.0000]

Cualquier coordenada fuera de estos límites es rechazada por `PuntoGeo` en `shared-kernel`.

Los límites se contrastaron el 2026-10-11 con OpenStreetMap (Nominatim) usando barrios de borde: Chasquipampa (-16.539, -68.048) y Ovejuyo (-16.535, -68.039) al este; Senkata (-16.583, -68.185) y Ventilla (-16.614, -68.171) al sur; San Roque, Distrito 7 de El Alto (-16.476, -68.276) al oeste; Achachicala (-16.431, -68.138) al norte. Todos quedan dentro con margen.

### 1.4 Definiciones
El lenguaje ubicuo del dominio está en [`glosario.md`](glosario.md). Los términos de ese glosario son normativos para este documento.

### 1.5 Referencias
- ISO/IEC/IEEE 29148:2018 — Ingeniería de requisitos.
- ISO/IEC/IEEE 12207 — Procesos del ciclo de vida del software.
- ISO/IEC 25010 — Modelo de calidad del producto ([`calidad.md`](calidad.md)).
- [`ROADMAP.md`](ROADMAP.md), [`adr/ADR-001.md`](adr/ADR-001.md), [`adr/ADR-002.md`](adr/ADR-002.md), [`riesgos.md`](riesgos.md), [`trazabilidad.md`](trazabilidad.md).

---

## 2. Descripción General

### 2.1 Perspectiva del Producto
Producto nuevo e independiente. Monolito modular hexagonal (ADR-001) con tres puntos de acceso sobre el mismo núcleo: PWA, API REST + WebSocket y bot de Telegram. Depende de servicios externos gratuitos: teselas de OpenStreetMap, API de bots de Telegram y servicios Web Push de los navegadores.

### 2.2 Interesados y Clases de Usuario

| Clase | Descripción | Historias |
| :--- | :--- | :--- |
| Ciudadano anónimo | Identificado solo por su dispositivo (o su cuenta de Telegram). Reporta, consulta, vota y se suscribe a zonas. | HU-01 a HU-09 |
| Moderador | Usuario con rol `MODERADOR`. Rechaza reportes falsos o que violan las reglas éticas. | HU-10, HU-12 |
| Investigador / periodista | Consume los datos abiertos anonimizados. No requiere cuenta. | HU-11 |
| Autor y tutor del proyecto de grado | Aprueban requisitos, ADR y resultados de cada fase. | — |

### 2.3 Restricciones
- Solo software libre o planes gratuitos; ningún servicio de pago (ADR-002).
- Stack fijado en ADR-002; no cambia sin un ADR nuevo.
- **Privacidad:** nunca se expone la `location` real ni el `author_id` en respuestas públicas; solo `public_location`.
- **Ética:** nunca se publican fotos ni descripciones de personas.
- Equipo unipersonal.

### 2.4 Supuestos y Dependencias
- Los usuarios disponen de un teléfono con navegador moderno y GPS; la precisión del GPS puede degradarse en quebradas y calles estrechas.
- La conectividad móvil es intermitente (motiva HU-05).
- En iOS las notificaciones Web Push solo funcionan con la PWA instalada (iOS 16.4 o superior) y no existe Background Sync; la cola sin conexión se envía entonces al evento `online`.
- Los planes gratuitos de hosting mantienen sus condiciones actuales (ver RSK-01 y RSK-02).

---

## 3. Parámetros del Dominio del MVP

### 3.1 Tabla de Categorías de Incidentes del MVP

| Código (`code`) | Nombre | TTL Inicial (`ttl_minutes`) | Radio de Deduplicación (`dedup_radius_m`) | Sensible (`is_sensitive`) | Política de Ubicación Pública |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `bloqueo` | Bloqueo o protesta vial | 360 min (6 h) | 100 m | No | Ubicación exacta |
| `accidente` | Accidente de tránsito | 180 min (3 h) | 50 m | No | Ubicación exacta |
| `robo` | Hecho delictivo / robo | 120 min (2 h) | 200 m | **Sí** | Centro de la celda de 200 m (`PoliticaDePrivacidad`) |
| `infraestructura` | Derrumbe / vía dañada / fuga | 1440 min (24 h) | 50 m | No | Ubicación exacta |
| `jauria` | Jauría de perros agresivos | 120 min (2 h) | 150 m | No | Ubicación exacta |

**Cálculo de la ubicación pública sensible:** la cuadrícula de 200 m se define en metros sobre la proyección UTM zona 19 Sur (EPSG:32719). `public_location` es el centro de la celda que contiene a `location`, transformado de vuelta a WGS84 (EPSG:4326). La deduplicación siempre se calcula sobre la `location` real.

### 3.2 Reglas Cuantitativas de Verificación y Reputación

1. **Reputación del Usuario** (dueño: módulo `verification`):
   - Todo usuario nuevo inicia con reputación base $R_0 = 1.0$.
   - Rango permitido: $[0.0, 5.0]$; todo ajuste se recorta a ese rango.

2. **Voto:**
   - El peso del voto es la reputación del votante en el momento de votar: $W = R$.
   - El autor de un reporte **no puede** votar sobre su propio reporte.
   - Cada usuario puede emitir un único voto por reporte.
   - Solo puede votar quien se encuentre a **1000 m o menos** de la `location` real del reporte.

3. **Transición a `CONFIRMADO`:**
   - Un reporte `ACTIVO` pasa a `CONFIRMADO` cuando se cumplen ambas condiciones:
     $$\sum W_{\text{confirmación}} \ge 3.0 \quad \text{y} \quad \text{votantes distintos} \ge 2$$
   - Un reporte duplicado (ver HU-01, escenario 2) cuenta como un voto de confirmación de quien lo envió.

4. **Extensión de vigencia** (máximo 2 por reporte, cada una de un **50 % del TTL original**):
   - Primera extensión: al pasar a `CONFIRMADO`.
   - Segunda extensión: cuando, ya `CONFIRMADO`, la suma ponderada de confirmaciones alcanza $6.0$.
   - La vida máxima de un reporte es, por tanto, el doble de su TTL original.

5. **Transición a `RESUELTO`:**
   - Un reporte `ACTIVO` o `CONFIRMADO` pasa a `RESUELTO` cuando se cumplen ambas condiciones:
     $$\sum W_{\text{negación}} \ge 3.0 \quad \text{y} \quad \text{votantes distintos} \ge 2$$

6. **Ajuste de Reputación:**
   - Reporte confirmado: $+0.20$ al autor.
   - Reporte rechazado por un moderador: $-0.50$ al autor.
   - Voto acertado (confirmación en un reporte que llega a `CONFIRMADO`, o negación en uno que llega a `RESUELTO`): $+0.05$ al votante.

7. **Usuario silenciado** ($R = 0.0$):
   - Sus votos se registran con peso 0 y no cuentan como votante distinto.
   - Sus reportes se crean `ACTIVO` y pasan de inmediato a `RECHAZADO` con motivo `AUTOR_SILENCIADO`, sin difundirse ni aplicar una nueva penalización. El usuario no recibe aviso.
   - **Recuperación:** transcurridos 30 días desde su última penalización, la reputación se restablece a $0.5$.

### 3.3 Otros Parámetros

Valores iniciales, ajustables durante el piloto mediante configuración.

| Parámetro | Valor |
| :--- | :--- |
| Límite de creación de reportes | 5 por usuario cada 10 minutos |
| Límite de votos | 30 por usuario cada 10 minutos |
| Zonas suscritas por usuario | máximo 5 |
| Radio de una zona suscrita | entre 100 m y 2000 m |
| Distancia máxima para votar | 1000 m |
| Distancia para el aviso automático "¿Sigue ahí?" | 150 m, con la app abierta |
| Tamaño de celda del mapa de calor | 250 m por defecto |
| Mínimo de reportes para mostrar una celda del mapa de calor | 3 |

---

## 4. Requisitos Funcionales

| ID | Requisito | Prioridad | Historias |
| :--- | :--- | :--- | :--- |
| **RF-01** | El sistema registra dispositivos de forma anónima y les emite una credencial. | Imprescindible | HU-01, HU-09 |
| **RF-02** | El sistema crea reportes georreferenciados dentro del rectángulo de la sección 1.3 y rechaza los que caen fuera. | Imprescindible | HU-01 |
| **RF-03** | El sistema convierte en confirmación todo reporte de la misma categoría dentro del radio de deduplicación de uno vigente. | Imprescindible | HU-01 |
| **RF-04** | El sistema devuelve los reportes `ACTIVO` y `CONFIRMADO` del área visible del mapa. | Imprescindible | HU-02 |
| **RF-05** | El sistema difunde en tiempo real los cambios de un reporte a los clientes que observan su celda geográfica. | Imprescindible | HU-02 |
| **RF-06** | El sistema expone solo `public_location`, ofuscada en categorías sensibles. | Imprescindible | HU-02 |
| **RF-07** | El sistema registra votos ponderados por reputación y aplica las transiciones y extensiones de la sección 3.2. | Imprescindible | HU-03 |
| **RF-08** | El sistema mantiene la reputación de cada usuario según la sección 3.2. | Imprescindible | HU-03, HU-12 |
| **RF-09** | El sistema caduca automáticamente los reportes vencidos. | Imprescindible | HU-04 |
| **RF-10** | La PWA encola reportes sin conexión y la API los procesa exactamente una vez por `idempotency_key`. | Imprescindible | HU-05 |
| **RF-11** | El sistema entrega un mapa de calor agregado por celdas con umbral de anonimato. | Importante | HU-06 |
| **RF-12** | El sistema permite crear y eliminar zonas suscritas. | Importante | HU-07 |
| **RF-13** | El sistema notifica por Web Push y Telegram los reportes que caen en una zona suscrita. | Importante | HU-08 |
| **RF-14** | El sistema permite reportar, consultar, votar y suscribirse desde un bot de Telegram. | Importante | HU-09 |
| **RF-15** | El sistema clasifica de forma asíncrona los reportes sospechosos para la cola de moderación. | Deseable | HU-10 |
| **RF-16** | El sistema publica y exporta datos históricos anonimizados. | Deseable | HU-11 |
| **RF-17** | El sistema permite a un moderador rechazar reportes y deja auditoría. | Deseable | HU-12 |

---

## 5. Historias de Usuario (HU)

### 5.1 Historias Imprescindibles (MVP)

#### HU-01: Crear reporte en dos toques con ubicación automática
- **Como** transeúnte o conductor en La Paz o El Alto.
- **Quiero** reportar un incidente pulsando únicamente la categoría con geolocalización automática.
- **Para** alertar a la comunidad sin distracciones ni pasos complejos.
- **Criterios de Aceptación:**
  - **Escenario 1: Creación exitosa en línea dentro del área geográfica**
    - **Dado** que tengo la PWA abierta con permisos de geolocalización concedidos y me encuentro en La Paz (-16.500, -68.150),
    - **Cuando** toco el botón de reportar y luego la categoría "Bloqueo",
    - **Entonces** el sistema captura mis coordenadas GPS, crea un reporte con estado `ACTIVO` y caducidad a 360 minutos, y lo difunde vía WebSocket al mapa.
  - **Escenario 2: Deduplicación automática**
    - **Dado** que ya existe un reporte de "Bloqueo" `ACTIVO` o `CONFIRMADO` de otro usuario a 40 metros de mi posición,
    - **Cuando** intento crear un reporte de "Bloqueo",
    - **Entonces** el sistema no crea un segundo reporte; registra mi acción como una **Confirmación** del reporte existente y me lo notifica en pantalla.
  - **Escenario 3: Coordenadas fuera de límites**
    - **Dado** que mi GPS reporta una ubicación en Cochabamba o fuera del rectángulo de La Paz y El Alto,
    - **Cuando** intento reportar un incidente,
    - **Entonces** el sistema rechaza la creación indicando que el servicio solo está disponible en La Paz y El Alto.
  - **Escenario 4: Duplicado de mi propio reporte**
    - **Dado** que yo mismo creé un reporte de "Bloqueo" que sigue vigente a 40 metros de mi posición,
    - **Cuando** intento crear otro reporte de "Bloqueo",
    - **Entonces** el sistema no crea un segundo reporte ni registra ningún voto, y me muestra mi reporte existente.
  - **Escenario 5: Límite de creación superado**
    - **Dado** que he creado 5 reportes en los últimos 10 minutos,
    - **Cuando** intento crear un sexto,
    - **Entonces** el sistema lo rechaza indicando que debo esperar.

#### HU-02: Ver reportes activos en el mapa en tiempo real
- **Como** habitante de La Paz o El Alto.
- **Quiero** ver sobre un mapa interactivo todos los incidentes activos y confirmados de mi zona visible.
- **Para** planificar mi ruta y evitar zonas de riesgo o congestión.
- **Criterios de Aceptación:**
  - **Escenario 1: Carga inicial de incidentes visibles**
    - **Dado** que abro la PWA en el navegador,
    - **Cuando** el mapa se centra en mi posición o en el centro de La Paz,
    - **Entonces** se muestran únicamente los reportes con estado `ACTIVO` o `CONFIRMADO` contenidos en el visor actual (*viewport*).
  - **Escenario 2: Actualización en vivo vía WebSocket**
    - **Dado** que tengo el mapa abierto en la zona de Miraflores,
    - **Cuando** otro usuario crea un reporte o se confirma un incidente en esa misma celda geográfica,
    - **Entonces** el nuevo marcador aparece en mi pantalla en menos de 2 segundos sin recargar la página.
  - **Escenario 3: Privacidad en categoría sensible**
    - **Dado** que se consulta un reporte de la categoría "Robo",
    - **Cuando** se visualiza en el mapa o a través de la API,
    - **Entonces** el marcador se ubica en el centro de la celda de 200 m (`public_location`) y nunca en la coordenada exacta.
  - **Escenario 4: Sin datos del autor ni ubicación real**
    - **Dado** cualquier reporte,
    - **Cuando** se obtiene por la API o por WebSocket,
    - **Entonces** la respuesta no contiene los campos `location` ni `author_id`.

#### HU-03: Confirmar o negar un reporte ("¿Sigue ahí?")
- **Como** usuario cercano a un incidente reportado.
- **Quiero** confirmar si el problema persiste o indicar que ya se despejó.
- **Para** mantener la información veraz y depurada.
- **Criterios de Aceptación:**
  - **Escenario 1: Confirmación que alcanza el umbral**
    - **Dado** un reporte `ACTIVO` de "Accidente" (TTL 180 min) que no es mío, con confirmaciones de un usuario que suman 2.0,
    - **Cuando** presiono "¿Sigue ahí? → Sí" con reputación 1.0 estando a menos de 1000 m,
    - **Entonces** la suma llega a 3.0 con 2 votantes distintos, el reporte pasa a `CONFIRMADO` y su caducidad se extiende 90 minutos.
  - **Escenario 2: Resolución comunitaria por negaciones**
    - **Dado** un reporte vigente con negaciones de dos usuarios que suman 2.0,
    - **Cuando** un tercer usuario con reputación 1.0 vota "¿Sigue ahí? → No",
    - **Entonces** la suma de negaciones alcanza 3.0, el reporte cambia a `RESUELTO` y desaparece de la vista activa del mapa.
  - **Escenario 3: Intento de voto por el propio autor**
    - **Dado** que soy el autor del reporte,
    - **Cuando** intento confirmar o negar mi propio incidente,
    - **Entonces** el sistema bloquea la acción con un mensaje de regla de negocio y no computa ningún voto.
  - **Escenario 4: Un solo votante no basta**
    - **Dado** un reporte `ACTIVO` sin votos,
    - **Cuando** un único usuario con reputación 4.0 lo confirma,
    - **Entonces** el voto se registra pero el reporte sigue `ACTIVO`, porque falta un segundo votante distinto.
  - **Escenario 5: Voto repetido**
    - **Dado** que ya voté sobre un reporte,
    - **Cuando** intento votar de nuevo,
    - **Entonces** el sistema rechaza el segundo voto.
  - **Escenario 6: Votante lejano**
    - **Dado** que me encuentro a más de 1000 m de un reporte,
    - **Cuando** intento confirmarlo o negarlo,
    - **Entonces** el sistema rechaza el voto indicando que debo estar cerca del incidente.
  - **Escenario 7: Segunda extensión**
    - **Dado** un reporte `CONFIRMADO` con una extensión aplicada y confirmaciones que suman 5.0,
    - **Cuando** un usuario con reputación 1.0 lo confirma,
    - **Entonces** la suma llega a 6.0 y la caducidad se extiende otro 50 % del TTL original; ninguna confirmación posterior la extiende más.

#### HU-04: Caducidad automática por categoría
- **Como** usuario de la plataforma.
- **Quiero** que los incidentes antiguos desaparezcan solos.
- **Para** evitar información obsoleta o confusa en el mapa.
- **Criterios de Aceptación:**
  - **Escenario 1: Caducidad por vencimiento de TTL**
    - **Dado** un reporte de "Accidente" creado hace 181 minutos con TTL de 180 minutos sin extensiones,
    - **Cuando** el caso de uso `ExpireReports` se ejecuta,
    - **Entonces** el reporte pasa de estado `ACTIVO` a `CADUCADO`, emitiendo el evento `ReporteCaducado.v1` y retirándose del mapa.
  - **Escenario 2: No caduca antes de tiempo**
    - **Dado** un reporte de "Accidente" creado hace 179 minutos sin extensiones,
    - **Cuando** `ExpireReports` se ejecuta,
    - **Entonces** el reporte conserva su estado.
  - **Escenario 3: Un reporte confirmado también caduca**
    - **Dado** un reporte `CONFIRMADO` cuya caducidad extendida ya pasó,
    - **Cuando** `ExpireReports` se ejecuta,
    - **Entonces** el reporte pasa a `CADUCADO`.

#### HU-05: Reportar sin conexión y sincronizar al reconectar
- **Como** usuario con cortes de señal móvil frecuentes.
- **Quiero** poder registrar incidentes en la PWA aunque no tenga acceso a internet en ese momento.
- **Para** que se publiquen automáticamente en cuanto recupere cobertura sin perder mis datos.
- **Criterios de Aceptación:**
  - **Escenario 1: Guardado en almacenamiento local**
    - **Dado** que mi teléfono entra en zona sin cobertura (modo avión / sin datos),
    - **Cuando** presiono el botón de reporte,
    - **Entonces** la PWA almacena el reporte en `IndexedDB` con una `idempotency_key` única y muestra un indicador de "pendiente de envío".
  - **Escenario 2: Sincronización transparente**
    - **Dado** uno o más reportes encolados localmente,
    - **Cuando** el dispositivo recupera conexión a internet,
    - **Entonces** la PWA envía la cola a la API (con Background Sync donde exista; si no, al evento `online`) y la cola local se limpia.
  - **Escenario 3: Reenvío idempotente**
    - **Dado** un reporte ya procesado por la API,
    - **Cuando** la PWA lo reenvía con la misma `idempotency_key`,
    - **Entonces** la API no crea un segundo reporte y devuelve el resultado original.

---

### 5.2 Historias Importantes

#### HU-06: Mapa de calor espacial agregado
- **Como** ciudadano o planificador urbano.
- **Quiero** visualizar un mapa de calor histórico agrupado por celdas geográficas.
- **Para** identificar patrones recurrentes de incidentes en la ciudad sin estigmatizar calles puntuales.
- **Criterios de Aceptación:**
  - **Escenario 1: Celda bajo el umbral**
    - **Dado** una celda con 2 reportes en el rango de fechas consultado,
    - **Cuando** se solicita el mapa de calor,
    - **Entonces** esa celda no aparece en la respuesta.
  - **Escenario 2: Celda sobre el umbral**
    - **Dado** una celda con 3 reportes en el rango de fechas consultado,
    - **Cuando** se solicita el mapa de calor,
    - **Entonces** la celda aparece con su conteo, sin puntos individuales.

#### HU-07: Suscripción a zonas geográficas de interés
- **Como** vecino o trabajador.
- **Quiero** definir áreas geográficas de mi interés (mi casa, mi ruta de trabajo).
- **Para** recibir alertas prioritarias de incidentes en esas zonas.
- **Criterios de Aceptación:**
  - **Escenario 1: Registro de suscripción**
    - **Dado** un usuario registrado con dispositivo o Telegram,
    - **Cuando** define un punto central, un radio de 800 m y las categorías deseadas,
    - **Entonces** el sistema almacena la zona suscrita.
  - **Escenario 2: Radio fuera de rango**
    - **Dado** un usuario registrado,
    - **Cuando** intenta crear una zona con radio de 2500 m,
    - **Entonces** el sistema la rechaza indicando el máximo de 2000 m.
  - **Escenario 3: Límite de zonas**
    - **Dado** un usuario con 5 zonas suscritas,
    - **Cuando** intenta crear una sexta,
    - **Entonces** el sistema la rechaza indicando el límite.
  - **Escenario 4: Baja de una zona**
    - **Dado** un usuario con una zona suscrita,
    - **Cuando** la elimina,
    - **Entonces** deja de recibir alertas de esa zona.

#### HU-08: Notificaciones de incidentes cercanos
- **Como** usuario suscrito a una zona.
- **Quiero** recibir una notificación cuando surja un reporte en mi área.
- **Para** tomar previsiones antes de desplazarme.
- **Criterios de Aceptación:**
  - **Escenario 1: Reporte dentro de la zona y la categoría**
    - **Dado** que tengo una zona suscrita a "Bloqueo" con radio de 800 m,
    - **Cuando** otro usuario crea un reporte de "Bloqueo" a 500 m del centro,
    - **Entonces** recibo una notificación con la categoría y la `public_location` del reporte.
  - **Escenario 2: Fuera de la zona o de la categoría**
    - **Dado** la misma zona suscrita,
    - **Cuando** se crea un "Bloqueo" a 900 m del centro, o un "Accidente" a 500 m,
    - **Entonces** no recibo notificación.
  - **Escenario 3: Una sola notificación por reporte**
    - **Dado** que ya fui notificado de un reporte al crearse,
    - **Cuando** ese reporte pasa a `CONFIRMADO`,
    - **Entonces** no recibo una segunda notificación.
  - **Escenario 4: No me notifico a mí mismo**
    - **Dado** que creo un reporte dentro de mi propia zona suscrita,
    - **Entonces** no recibo notificación de ese reporte.

#### HU-09: Bot de Telegram para consulta y reporte
- **Como** usuario frecuente de Telegram.
- **Quiero** interactuar con un bot para reportar, consultar y suscribirme.
- **Para** usar el servicio sin necesidad de abrir el navegador web.
- **Criterios de Aceptación:**
  - **Escenario 1: Vinculación**
    - **Dado** que escribo al bot por primera vez,
    - **Cuando** envío `/start`,
    - **Entonces** se crea mi usuario asociado a mi identificador de Telegram.
  - **Escenario 2: Reportar**
    - **Dado** que envié `/reportar` y elegí una categoría,
    - **Cuando** comparto mi ubicación,
    - **Entonces** se crea el reporte con las mismas reglas de HU-01 y aparece en la PWA en tiempo real.
  - **Escenario 3: Consultar**
    - **Dado** que compartí mi ubicación,
    - **Cuando** envío `/cerca`,
    - **Entonces** recibo los reportes vigentes a 1 km o menos, con botones "Sigue ahí" / "Ya no está" que aplican las reglas de HU-03.
  - **Escenario 4: Suscribirse**
    - **Dado** que envío `/zona`, comparto una ubicación y elijo un radio,
    - **Entonces** se crea la zona suscrita con las reglas de HU-07 y las alertas me llegan por Telegram.

---

### 5.3 Historias Deseables

#### HU-10: Clasificación automática de reportes sospechosos
- **Como** moderador.
- **Quiero** que el sistema marque los reportes con indicios de spam mediante un clasificador detrás de `ClassifierPort`.
- **Para** revisar primero lo que más probablemente sea falso.
- **Criterios de Aceptación:**
  - **Escenario 1: Reporte sospechoso**
    - **Dado** un reporte cuya descripción contiene un enlace o palabras de la lista de spam,
    - **Cuando** el clasificador lo procesa tras `ReporteCreado`,
    - **Entonces** el reporte aparece marcado en la cola de moderación.
  - **Escenario 2: La creación no espera al clasificador**
    - **Dado** que el servicio de clasificación está caído,
    - **Cuando** un usuario crea un reporte,
    - **Entonces** el reporte se crea y difunde con normalidad, y se clasifica con las reglas locales.

#### HU-11: Portal y exportación de datos abiertos anonimizados
- **Como** investigador o periodista.
- **Quiero** descargar datos históricos en CSV.
- **Para** realizar análisis académicos o auditoría cívica.
- **Criterios de Aceptación:**
  - **Escenario 1: Exportación anonimizada**
    - **Dado** reportes históricos en cualquier estado final,
    - **Cuando** descargo el archivo de datos abiertos,
    - **Entonces** cada fila contiene solo categoría, celda geográfica, fecha truncada a la hora y estado final; no contiene usuarios ni puntos exactos.
  - **Escenario 2: Licencia**
    - **Dado** el portal de datos abiertos,
    - **Entonces** declara de forma visible la licencia abierta de los datos.

#### HU-12: Moderación y auditoría de incidentes
- **Como** moderador de la plataforma.
- **Quiero** revisar reportes negados o marcados y rechazar los falsos.
- **Para** mantener la calidad e integridad de la red comunitaria.
- **Criterios de Aceptación:**
  - **Escenario 1: Rechazo con motivo**
    - **Dado** un reporte vigente y un usuario con rol `MODERADOR`,
    - **Cuando** lo rechaza indicando un motivo,
    - **Entonces** el reporte pasa a `RECHAZADO`, se retira del mapa, se emite `ReporteRechazado.v1`, la acción queda en la auditoría y la reputación del autor baja 0.50.
  - **Escenario 2: Rol insuficiente**
    - **Dado** un usuario sin rol `MODERADOR`,
    - **Cuando** intenta rechazar un reporte,
    - **Entonces** el sistema deniega la acción.
  - **Escenario 3: Contenido con personas**
    - **Dado** un reporte cuya descripción o foto identifica a una persona,
    - **Cuando** el moderador lo revisa,
    - **Entonces** debe rechazarlo conforme a la regla ética de la sección 2.3.

---

## 6. Interfaces Externas

| Interfaz | Uso | Restricción |
| :--- | :--- | :--- |
| Teselas de OpenStreetMap | Mapa base de la PWA | Respetar la política de uso de teselas: caché con límite, sin descarga masiva |
| API de bots de Telegram | Canal de entrada y de notificaciones | Webhook; respetar los límites de envío |
| Web Push (VAPID) | Notificaciones en la PWA | En iOS requiere PWA instalada |
| Geolocalización del navegador | Ubicación automática del reporte | Requiere permiso del usuario |

## 7. Requisitos No Funcionales
Definidos con ID, métrica y umbral en [`calidad.md`](calidad.md) (RNF-01 a RNF-14).

## 8. Verificación
Cada escenario de la sección 5 se verifica con al menos una prueba automatizada cuyo nombre lleva el ID de la historia (`HU-03: ...`). La correspondencia requisito → historia → prueba se mantiene en [`trazabilidad.md`](trazabilidad.md) y se completa fase a fase.
