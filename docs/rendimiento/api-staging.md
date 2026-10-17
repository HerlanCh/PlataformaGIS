# Rendimiento y seguridad de la API en staging

Evidencia del criterio de salida de la Fase 6 (ISO/IEC 25010: eficiencia RNF-09 y seguridad RNF-13).

## Entorno

- **API:** `https://plataforma-gis-api.onrender.com`, plan gratuito de Render (región Virginia), versión `v2.3.0` (commit `f0acb3c`).
- **Base de datos:** Neon con PostgreSQL 18 y PostGIS 3.6, migrada al arrancar.
- **Módulos activos:** `reports`, `verification` e `identity`, más `heatmap`, `subscriptions` y `moderation`.
- **Cliente de carga:** k6 2.3.0 en Docker, desde la máquina de desarrollo. Cada solicitud cruza internet hasta Virginia, así que la latencia incluye el viaje de red.

## Carga básica con k6 (RNF-09: p95 < 300 ms)

Escenario `tools/carga/api-basica.js`, ejecutado el 2026-10-17T21:39Z:
- **Usuarios virtuales:** sube a 4 en 30 s, se mantiene 2 min y baja en 15 s.
- **Iteración:** cada usuario registra su dispositivo una vez. En cada iteración lista una ventana del mapa, pide el mapa de calor de 30 días, crea un reporte (hasta 5) y vota uno de la lista; luego espera 4 s.
- **Límite por IP:** el ritmo queda bajo las 300 solicitudes por minuto, porque k6 sale de una sola IP.

| Medida | Valor |
| :--- | ---: |
| Solicitudes | 344 |
| Fallidas | 0 % |
| **p95 global** | **245 ms** (cumple) |

| Ruta | p95 (ms) |
| :--- | ---: |
| `POST /v1/dispositivos` | 481 |
| `POST /v1/reportes` | 265 |
| `GET /v1/reportes` | 225 |
| `GET /v1/mapa-calor` | 225 |
| `POST /v1/reportes/:id/confirmar` | 268 |

El registro de dispositivo supera los 300 ms. Solo se hace una vez por usuario, así que su p95 sale de muy pocas muestras (4), y las primeras solicitudes abren las conexiones al pool de Neon. Con la misma API en local, el p95 global fue de 12,7 ms: casi todo el tiempo en staging es red y el plan gratuito.

Comando:

```
docker run --rm -v "$PWD/tools/carga:/carga" -e BASE_URL=https://plataforma-gis-api.onrender.com grafana/k6:2.3.0 run /carga/api-basica.js
```

## OWASP ZAP baseline (RNF-13: 0 hallazgos altos)

El flujo `.github/workflows/zap.yml` (ejecución `39071261409`, 2026-10-17) esperó a que staging sirviera `f0acb3c` y escaneó `/docs`.

| Riesgo | Hallazgos |
| :--- | :--- |
| **Alto** | **0** (cumple) |
| Medio | CSP sin directiva de respaldo y con comodín; librería JS vulnerable |
| Bajo | Falta `Cross-Origin-Embedder-Policy` y `Permissions-Policy`; marca de tiempo Unix |
| Informativo | Cabeceras `Sec-Fetch-*`, directivas de caché, contenido Base64 |

Los hallazgos medios vienen de la página de Swagger UI en `/docs`: su CSP propio (`staticCSP`) y la versión de su bundle de JavaScript. Las rutas `/v1` devuelven solo JSON con `default-src 'none'`. Quedan pendientes en la bitácora.
