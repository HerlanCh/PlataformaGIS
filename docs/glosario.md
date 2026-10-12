# Glosario de Términos (Lenguaje Ubicuo)

Este glosario establece el lenguaje ubicuo compartido entre el equipo de desarrollo, los interesados y los modelos de dominio de la **Plataforma GIS de alerta temprana para La Paz y El Alto**. Todos los módulos, interfaces y pruebas deben usar estos términos estrictamente. Cada término tiene un único módulo dueño.

---

| Término | Definición en el Dominio | Dueño |
| :--- | :--- | :--- |
| **Reporte (`Report`)** | Incidente urbano georreferenciado publicado por un usuario anónimo. Posee una máquina de estados explícita (`ACTIVO`, `CONFIRMADO`, `RESUELTO`, `CADUCADO`, `RECHAZADO`). Se llama **vigente** mientras está `ACTIVO` o `CONFIRMADO`. | `reports` |
| **Categoría (`Category`)** | Clasificación del reporte que define su naturaleza urbana, su tiempo de vida por defecto (TTL), su radio de deduplicación y si es sensible. | `reports` |
| **Ubicación Real (`Location`)** | Coordenadas exactas en WGS84 donde se registró el incidente. Dato estrictamente privado; nunca se expone en respuestas públicas. | `reports` |
| **Ubicación Pública (`PublicLocation`)** | Coordenadas WGS84 mostradas al público. En categorías sensibles es el centro de la celda de 200 m que contiene a la ubicación real (`PrivacyPolicy`). | `reports` |
| **Confirmación (`Confirmation`)** | Voto positivo ("¿Sigue ahí? → Sí") que aumenta la certidumbre de un reporte vigente. Un reporte duplicado cuenta como confirmación. | `verification` |
| **Negación (`Denial`)** | Voto negativo ("¿Sigue ahí? → No / Ya no está"). Si acumula suficiente peso, fuerza la transición a `RESUELTO`. | `verification` |
| **Ponderación de Voto (`VoteWeight`)** | Peso de un voto, igual a la reputación del votante en el momento de votar. | `verification` |
| **Reputación (`Reputation`)** | Puntuación de un usuario entre 0.0 y 5.0, calculada a partir del acierto histórico de sus reportes y votos. Determina el peso de sus votos. | `verification` |
| **Silenciado** | Usuario con reputación 0.0. Sus votos no cuentan y sus reportes se rechazan de inmediato sin difundirse. Se recupera a 0.5 tras 30 días sin penalizaciones. | `verification` |
| **Caducidad (`Expiration`)** | Transición automática de un reporte vigente a `CADUCADO` al cumplirse su fecha de caducidad (`caduca_en`), sin intervención humana. | `reports` |
| **Extensión de vigencia** | Aumento de la fecha de caducidad (`caduca_en`) en un 50 % del TTL original. Máximo 2 por reporte. | `reports` |
| **Deduplicación (`Deduplication`)** | Proceso por el cual un nuevo reporte dentro del radio de deduplicación (`radio_duplicado_m`) de otro reporte vigente de la misma categoría no crea un incidente nuevo, sino una confirmación del existente. | `reports` |
| **Clave de Idempotencia (`IdempotencyKey`)** | Identificador único generado por el cliente para cada reporte. Garantiza que un reenvío por fallos de red se procese exactamente una vez. | `reports` |
| **Modo Fuera de Línea (`Offline Mode`)** | Capacidad de la PWA para guardar reportes en `IndexedDB` sin conectividad y enviarlos al restablecerse la red. | `apps/web` |
| **Zona Suscrita (`ZoneSubscription`)** | Área de interés de un usuario definida por un punto central, un radio en metros y una lista de categorías, usada para el envío de alertas. | `subscriptions` |
| **Celda Geográfica (`GeoCell`)** | Cuadrante determinístico que agrupa puntos cercanos. Se usa en dos formas: celda **geohash** (función pura `cellOf`) para las salas de tiempo real, y celda de **cuadrícula métrica** para el mapa de calor y la ubicación pública sensible. | `shared-kernel` (geohash) / `heatmap` y `reports` (cuadrícula) |
| **Moderador** | Usuario con rol `MODERADOR`, autorizado a rechazar reportes. Toda acción suya queda auditada. | `identity` (rol) / `moderation` (acciones) |
