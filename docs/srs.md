# Especificación de Requisitos de Software (SRS)

**Estándar:** ISO/IEC/IEEE 29148:2018  
**Proyecto:** Plataforma GIS de alerta temprana — La Paz y El Alto  
**Versión:** 1.0.0 — Fase 0  
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

### 1.3 Límites Geográficos del Dominio
El sistema opera dentro del rectángulo envolvente (*Bounding Box*) de la conurbación La Paz – El Alto:
- **Latitud:** [-16.5800, -16.4200]
- **Longitud:** [-68.2500, -68.0800]
Cualquier coordenada fuera de estos límites es rechazada por el `shared-kernel` en el dominio.

---

## 2. Parámetros del Dominio del MVP

### 2.1 Tabla de Categorías de Incidentes del MVP

| Código (`code`) | Nombre | TTL Inicial (`ttl_minutes`) | Radio de Deduplicación (`dedup_radius_m`) | Sensible (`is_sensitive`) | Política de Ubicación Pública |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `bloqueo` | Bloqueo o protesta vial | 360 min (6 h) | 100 m | No | Ubicación exacta |
| `accidente` | Accidente de tránsito | 180 min (3 h) | 50 m | No | Ubicación exacta |
| `robo` | Hecho delictivo / robo | 120 min (2 h) | 200 m | **Sí** | Redondeo a grilla de 200 m (`PrivacyPolicy`) |
| `infraestructura` | Derrumbe / vía dañada / fuga | 1440 min (24 h) | 50 m | No | Ubicación exacta |
| `jauria` | Jauría de perros agresivos | 120 min (2 h) | 150 m | No | Ubicación exacta |

### 2.2 Reglas Cuantitativas de Verificación y Reputación

1. **Reputación del Usuario:**
   - Todo nuevo usuario o dispositivo registrado inicia con una reputación base: $R_0 = 1.0$.
   - Rango permitido: $[0.0, 5.0]$.
   - Usuarios con reputación $R = 0.0$ son considerados silenciados (*shadowbanned*); sus reportes nacen en estado `RECHAZADO` y sus votos no se computan.

2. **Peso del Voto:**
   - El peso del voto emitido por un usuario es igual a su reputación actual: $W = R$.
   - El autor de un reporte **no puede** votar sobre su propio reporte.
   - Cada usuario puede emitir un único voto por reporte.

3. **Transición a `CONFIRMADO`:**
   - Un reporte en estado `ACTIVO` pasa automáticamente a `CONFIRMADO` si la suma ponderada de confirmaciones cumple:
     $$\sum W_{\text{confirmación}} \ge 3.0$$
   - Al confirmarse, el tiempo de expiración del reporte se extiende en un **50 % de su TTL original** (máximo 2 extensiones por reporte).

4. **Transición a `RESUELTO`:**
   - Un reporte en estado `ACTIVO` o `CONFIRMADO` pasa automáticamente a `RESUELTO` si la suma ponderada de negaciones cumple:
     $$\sum W_{\text{negación}} \ge 3.0$$

5. **Ajuste de Reputación:**
   - Reporte confirmado: $+0.20$ de reputación al autor.
   - Reporte rechazado por moderación (falso/spam): $-1.00$ de reputación al autor.
   - Voto acertado (concordante con el estado final `CONFIRMADO` o `RESUELTO`): $+0.05$ de reputación al votante.

---

## 3. Historias de Usuario (HU)

### 3.1 Historias Imprescindibles (MVP)

#### HU-01: Crear reporte en dos toques con ubicación automática
- **Como** transeúnte o conductor en La Paz o El Alto.
- **Quiero** reportar un incidente pulsando únicamente la categoría con geolocalización automática.
- **Para** alertar a la comunidad en menos de 5 segundos sin distracciones ni pasos complejos.
- **Criterios de Aceptación:**
  - **Escenario 1: Creación exitosa en línea dentro del área geográfica**
    - **Dado** que tengo la PWA abierta con permisos de geolocalización concedidos y me encuentro en La Paz (-16.500, -68.150),
    - **Cuando** toco el botón de la categoría "Bloqueo",
    - **Entonces** el sistema captura mis coordenadas GPS, crea un reporte con estado `ACTIVO`, TTL de 360 minutos y lo difunde inmediatamente vía WebSocket al mapa.
  - **Escenario 2: Deduplicación automática**
    - **Dado** que ya existe un reporte de "Bloqueo" activo a 40 metros de mi posición,
    - **Cuando** intento crear un reporte de "Bloqueo",
    - **Entonces** el sistema no crea un segundo reporte; en su lugar, registra mi acción como una **Confirmación** del reporte existente y me notifica en pantalla.
  - **Escenario 3: Coordenadas fuera de límites**
    - **Dado** que mi GPS reporta una ubicación en Cochabamba o fuera de La Paz/El Alto,
    - **Cuando** intento reportar un incidente,
    - **Entonces** el sistema rechaza la creación indicando que el servicio solo está disponible en La Paz y El Alto.

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
    - **Entonces** el marcador se ubica en el centroide de la cuadrícula de 200 m (`public_location`) y nunca en la coordenada exacta de la víctima.

#### HU-03: Confirmar o negar un reporte ("¿Sigue ahí?")
- **Como** usuario cercano a un incidente reportado.
- **Quiero** confirmar si el problema persiste o indicar que ya se despejó.
- **Para** mantener la información veraz y depurada.
- **Criterios de Aceptación:**
  - **Escenario 1: Confirmación de reporte**
    - **Dado** un reporte activo en el mapa y que no soy el autor del mismo,
    - **Cuando** presiono "¿Sigue ahí? → Sí",
    - **Entonces** se registra mi voto con el peso de mi reputación, se extiende la vigencia del reporte si se cumplen las reglas y el contador visual de confirmaciones se actualiza.
  - **Escenario 2: Resolución comunitaria por negaciones**
    - **Dado** un reporte activo que acumula 2 votos de negación con peso 2.0,
    - **Cuando** un usuario con reputación 1.0 vota "¿Sigue ahí? → No",
    - **Entonces** la suma acumulada de negaciones alcanza 3.0, el reporte cambia automáticamente a estado `RESUELTO` y desaparece de la vista activa del mapa.
  - **Escenario 3: Intento de voto por el propio autor**
    - **Dado** que soy el autor del reporte,
    - **Cuando** intento confirmar o negar mi propio incidente,
    - **Entonces** el sistema bloquea la acción con un mensaje de regla de negocio y no computa ningún voto.

#### HU-04: Caducidad automática por categoría
- **Como** usuario de la plataforma.
- **Quiero** que los incidentes antiguos que no recibieron confirmación desaparezcan solos.
- **Para** evitar información obsoleta o confusa en el mapa.
- **Criterios de Aceptación:**
  - **Escenario 1: Caducidad por vencimiento de TTL**
    - **Dado** un reporte de "Accidente" creado hace 181 minutos con TTL de 180 minutos sin extensiones,
    - **Cuando** el caso de uso `ExpireReports` se ejecuta,
    - **Entonces** el reporte pasa de estado `ACTIVO` a `CADUCADO`, emitiendo el evento `ReportExpired.v1` y retirándose del mapa.

#### HU-05: Reportar sin conexión y sincronizar al reconectar
- **Como** usuario con cortes de señal móvil frecuentes.
- **Quiero** poder registrar incidentes en la PWA aunque no tenga acceso a internet en ese momento.
- **Para** que se publiquen automáticamente en cuanto recupere cobertura sin perder mis datos.
- **Criterios de Aceptación:**
  - **Escenario 1: Guardado en almacenamiento local**
    - **Dado** que mi teléfono entra en zona sin cobertura (modo avión / sin datos),
    - **Cuando** presiono el botón de reporte,
    - **Entonces** la PWA almacena el reporte en `IndexedDB` con una `idempotency_key` única y muestra un indicador de "Encolado para sincronización".
  - **Escenario 2: Sincronización transparente**
    - **Dado** uno o más reportes encolados localmente,
    - **Cuando** el dispositivo recupera conexión a internet,
    - **Entonces** el Service Worker transmite la cola de reportes a la API; la API procesa la solicitud exactamente una vez gracias a la `idempotency_key` y la cola local se limpia.

---

### 3.2 Historias Importantes

#### HU-06: Mapa de calor espacial agregado
- **Como** ciudadano o planificador urbano.
- **Quiero** visualizar un mapa de calor histórico agrupado por celdas geográficas.
- **Para** identificar patrones recurrentes de incidentes en la ciudad sin estigmatizar calles puntuales.
- **Criterios de Aceptación:**
  - **Escenario 1: Umbral de agregación y privacidad**
    - **Dado** un área geográfica con incidentes históricos,
    - **Cuando** se solicita el mapa de calor,
    - **Entonces** el backend agrupa los puntos con `ST_SnapToGrid` y descarta toda celda que tenga menos de 3 reportes para proteger el anonimato y evitar estigmatizaciones.

#### HU-07: Suscripción a zonas geográficas de interés
- **Como** vecino o trabajador.
- **Quiero** definir áreas geográficas de mi interés (mi casa, mi ruta de trabajo).
- **Para** recibir alertas prioritarias de incidentes en esas zonas.
- **Criterios de Aceptación:**
  - **Escenario 1: Registro de suscripción**
    - **Dado** un usuario registrado con dispositivo o Telegram,
    - **Cuando** delimita un punto central, un radio (máx. 2000 m) y las categorías deseadas,
    - **Entonces** el sistema almacena la suscripción espacial indexada en PostGIS.

#### HU-08: Notificaciones Push de incidentes cercanos
- **Como** usuario suscrito a una zona.
- **Quiero** recibir una notificación Web Push instantánea cuando surja un reporte en mi área.
- **Para** tomar previsiones antes de desplazarme.

#### HU-09: Bot de Telegram para consulta y reporte
- **Como** usuario frecuente de Telegram.
- **Quiero** interactuar con un bot oficial para enviar mi ubicación y reportar o consultar incidentes.
- **Para** usar el servicio sin necesidad de abrir el navegador web.

---

### 3.3 Historias Deseables

#### HU-10: Clasificación asistida por reglas o IA
- **Como** moderador o sistema.
- **Quiero** categorizar descripciones de texto libre mediante un clasificador detrás de `ClassifierPort`.
- **Para** asistir al usuario si no sabe qué categoría elegir.

#### HU-11: Portal y exportación de datos abiertos anonimizados
- **Como** investigador o periodista.
- **Quiero** descargar datos históricos en GeoJSON/CSV con coordenadas anonimizadas.
- **Para** realizar análisis académicos o auditoría cívica.

#### HU-12: Moderación y auditoría de incidentes
- **Como** moderador de la plataforma.
- **Quiero** revisar reportes denunciados, rechazar información falsa y aplicar penalizaciones de reputación.
- **Para** mantener la calidad e integridad de la red comunitaria.
