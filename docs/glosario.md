# Glosario de Términos (Lenguaje Ubicuo)

Este glosario establece el lenguaje ubicuo compartido entre el equipo de desarrollo, los interesados y los modelos de dominio de la **Plataforma GIS de alerta temprana para La Paz y El Alto**. Todos los módulos, interfaces y pruebas deben usar estos términos estrictamente.

---

| Término | Definición en el Dominio | Módulo Propietario |
| :--- | :--- | :--- |
| **Reporte (`Report`)** | Incidente urbano georreferenciado publicado por un usuario (anónimo o identificado). Posee una máquina de estados explícita (`ACTIVO`, `CONFIRMADO`, `RESUELTO`, `CADUCADO`, `RECHAZADO`). | `reports` |
| **Categoría (`Category`)** | Clasificación del reporte que define su naturaleza urbana, su tiempo de vida por defecto (TTL), su radio de deduplicación y si requiere protección de privacidad por ser sensible. | `reports` |
| **Ubicación Real (`Location`)** | Coordenadas exactas en WGS84 (`geometry(Point, 4326)`) donde ocurrió o se registró el incidente. Dato estrictamente privado; nunca se expone en la API pública. | `reports` / `shared-kernel` |
| **Ubicación Pública (`PublicLocation`)** | Coordenadas WGS84 mostradas a los usuarios y consumidores públicos. En incidentes sensibles se aplica ofuscación (redondeo a celda o cuadrícula mediante `PrivacyPolicy`) para proteger la privacidad del usuario o víctimas. | `reports` |
| **Confirmación (`Confirmation`)** | Voto positivo de la comunidad ("¿Sigue ahí? → Sí") que aumenta la certidumbre de un reporte activo e incrementa su vigencia temporal. | `verification` |
| **Negación (`Denial`)** | Voto negativo de la comunidad ("¿Sigue ahí? → No / Ya no está") emitido por un usuario cercano al incidente. Si acumula suficiente peso, fuerza la transición a `RESUELTO`. | `verification` |
| **Caducidad (`Expiration`)** | Transición temporal automática mediante la cual un reporte pasa de `ACTIVO` o `CONFIRMADO` a `CADUCADO` al cumplirse su tiempo de vida (`expires_at`), sin intervención humana. | `reports` |
| **Reputación (`Reputation`)** | Puntuación numérica asociada a un usuario (o huella de dispositivo) calculada a partir de la precisión histórica de sus reportes y votos. Determina el peso (`weight`) de sus votos en `VerificationPolicy`. | `verification` / `identity` |
| **Zona Suscrita (`ZoneSubscription`)** | Área de interés configurada por un usuario definida por un punto central (`center`), un radio en metros (`radius_m`) y una lista de categorías de interés, utilizada para el despacho de alertas. | `subscriptions` |
| **Celda Geográfica (`GeoCell`)** | Cuadrante geográfico determinístico obtenido mediante codificación espacial (precisión geohash o `ST_SnapToGrid`) utilizado para agrupar clientes WebSocket en salas de tiempo real y agregar datos del mapa de calor. | `heatmap` / `shared-kernel` |
| **Deduplicación (`Deduplication`)** | Proceso mediante el cual un nuevo reporte dentro del radio de influencia (`dedup_radius_m`) de otro reporte activo de la misma categoría no crea un nuevo incidente, sino que se convierte automáticamente en una confirmación del existente. | `reports` |
| **Clave de Idempotencia (`IdempotencyKey`)** | Identificador único generado por el cliente al redactar un reporte sin conexión (offline). Garantiza que si el reporte se reenvía múltiples veces por fallos de red, la base de datos lo procese exactamente una vez. | `reports` / `platform` |
| **Modo Fuera de Línea (`Offline Mode`)** | Capacidad de la PWA para registrar reportes en almacenamiento local (`IndexedDB`) ante la pérdida de conectividad, encolándolos para envío automático al restablecerse la red. | `web` / `reports` |
| **Ponderación de Voto (`VoteWeight`)** | Peso cuantitativo que tiene el voto de un usuario sobre el umbral de verificación o resolución de un incidente, derivado de su reputación. | `verification` |
