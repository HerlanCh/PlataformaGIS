# Eficiencia del sistema completo (Fase 11)

Evidencia de las pruebas 1 y 2 de la Fase 11 (ISO/IEC 25010, eficiencia de desempeño). Cubre:
- RNF-09: p95 de la API < 300 ms;
- RNF-10: difusión p95 < 2 s con 500 clientes;
- RNF-11: consultas espaciales p95 < 100 ms con 100.000 reportes;
- RNF-08: errores 5xx < 1 %.

Ejecutadas el 2026-10-21 sobre la versión `a2ba65c` (`v2.12.1` y el flujo de respaldo).

## Dónde se mide y por qué

El roadmap pide el escenario completo «en staging con la base de 100.000 reportes». Se divide en dos entornos, una
**desviación aceptada** en el plan de la fase:
- **Local con 100.000 reportes:** API compilada en modo producción con todos los módulos activos, PostGIS 18-3.6 en
  Docker y `pnpm seed:load`. Mide el costo de la API y de las consultas con la base llena, sin la red de por medio.
  No se cargan 100.000 reportes sintéticos en staging porque ensuciarían el mapa público y los datos abiertos, y
  `seed:load` solo corre contra una base local.
- **Staging (Render y Neon) con sus datos reales:** mide lo que vive una persona usuaria, con el viaje de red hasta
  Virginia y el plan gratuito.

El cliente es k6 2.3.0 instalado en la máquina (el binario oficial para Windows). Con k6 en Docker, el reenvío de
puertos de Docker Desktop hacia `host.docker.internal` dejó un 15 % de conexiones sin abrir (`dial: i/o timeout`). La
API no registró ningún error en esa corrida: era el tramo de red del contenedor, no la API.

Máquina local: AMD Ryzen 5 5600G, 12 hilos, 16 GB de RAM, Windows 11 y Node 24.20.

## 1. Escenario completo con k6 (RNF-09 y RNF-08)

`tools/carga/escenario-completo.js` recorre todas las funciones públicas en cada iteración:
1. ventana del mapa (`GET /v1/reportes`);
2. mapa de calor de 30 días;
3. crear un reporte, hasta 5 por usuario;
4. confirmar uno de la lista, hasta 30 por usuario: los límites de la API cada 10 minutos;
5. zona suscrita (alta, lista y baja, alternando);
6. resumen de datos abiertos.

Cada usuario virtual registra antes su dispositivo. Exige `p95 < 300 ms` global y por ruta (salvo el registro, que
ocurre una vez por usuario) y fallos < 1 %.

### Local, 100.000 reportes

| Carga | Solicitudes | Fallidas | p95 global | Peor ruta (p95) | Resultado |
| :-- | --: | --: | --: | :-- | :-- |
| **Referencia:** 4 usuarios, 4 s de pausa, 2 min | 794 | 0 % | **19 ms** | mapa de calor, 23 ms | Cumple |
| 25 usuarios, 1 s de pausa (≈ 100 solicitudes/s) | 16.069 | 0 % | 39 ms | mapa de calor, 53 ms | Cumple |
| 50 usuarios, 1 s de pausa (≈ 170 solicitudes/s) | 26.171 | 0 % | 177 ms | votar, 446 ms | Supera el umbral en votar |

Con 50 usuarios se satura el proceso: crear, votar y las zonas suben juntos (260, 446 y 150 a 215 ms). Coincide con el
pool acotado a 5 conexiones (RSK-02, por el límite del plan gratuito). Es un **límite de capacidad documentado, no un
defecto**:
- la carga de referencia queda 15 veces por debajo del umbral;
- el sistema sostiene unas 100 solicitudes/s con p95 < 60 ms;
- incluso saturado, no hubo ningún error.

### Staging (Render y Neon)

4 usuarios, 7 s de pausa y 3 min sostenidos: unas 8 solicitudes por iteración, bajo el límite de 300 solicitudes por
minuto por IP.

| Medida | Valor |
| :-- | --: |
| Solicitudes | 520 |
| Fallidas | 0 % |
| **p95 global** | **261 ms** (cumple) |

| Ruta | p95 (ms) |
| :-- | --: |
| `GET /v1/reportes` | 246 |
| `GET /v1/mapa-calor` | 246 |
| `POST /v1/reportes` | 271 |
| `POST /v1/reportes/:id/confirmar` | 260 |
| `POST /v1/suscripciones` | 261 |
| `GET /v1/suscripciones` | 248 |
| `DELETE /v1/suscripciones/:id` | 244 |
| `GET /v1/datos-abiertos/resumen` | 273 |
| `POST /v1/dispositivos` (sin umbral, 4 muestras) | 514 |

En local, la misma API responde en menos de 25 ms: casi todo el tiempo en staging es red. El registro repite lo
observado en la Fase 6: abre las primeras conexiones al pool de Neon. Ocurre una sola vez por dispositivo.

### RNF-08: tasa de errores 5xx

En las cuatro corridas (43.554 solicitudes) hubo **0 respuestas fallidas**: ningún 5xx ni ningún 4xx inesperado. La
API no registró ningún error. **Cumple** (umbral < 1 %).

### Defectos del guion corregidos al prepararlo

No eran defectos de la API, pero falseaban la medición:
- **Baja de zona:** el guion enviaba `content-type: application/json` sin cuerpo y Fastify lo rechazaba con 400. Ahora
  `tools/carga/comun.js` solo declara JSON cuando hay cuerpo.
- **Votos:** el guion votaba en cada iteración y la API respondía `429` al pasar los 30 votos por usuario. Ahora
  respeta el límite.
- **Agrupación:** las URL con ID se agrupan por ruta (etiqueta `name`) y el resumen informa las verificaciones que
  fallan.

## 2. Difusión en tiempo real con 500 clientes (RNF-10)

`pnpm carga:difusion`:
- 500 clientes Socket.io en 10 zonas;
- 20 reportes;
- latencia desde el `POST` hasta la llegada de `ReporteCreado` a cada cliente de su zona.

Con la base densa, muchos puntos al azar caen como duplicados, así que ahora cada intento usa otro usuario y nadie
pasa de su límite de reportes.

| Entorno | Entregas | A otra zona | p50 | **p95** | Máximo | Resultado |
| :-- | :-: | :-: | --: | --: | --: | :-- |
| Local, 100.000 reportes | 1000 de 1000 | 0 | 200 ms | **337 ms** | 442 ms | Cumple |
| Staging | 1000 de 1000 | 0 | 438 ms | **708 ms** | 760 ms | Cumple |

## 3. Consultas espaciales con 100.000 reportes (RNF-11)

`pnpm perf:espacial` regeneró [`consultas-espaciales.md`](consultas-espaciales.md): 100.909 reportes (20.877
vigentes) y 5.696 zonas. Las 9 consultas usan índice y cumplen; la más lenta es el mapa de calor de toda el área de
servicio, con un **p95 de 42,4 ms** (umbral 100 ms).

## Cómo repetirlo

```
docker compose up -d
FEATURE_SUBSCRIPTIONS=true FEATURE_NOTIFICATIONS=true FEATURE_HEATMAP=true FEATURE_MODERATION=true \
  FEATURE_OPEN_DATA=true FEATURE_CLASSIFIER=true pnpm db:migrate
pnpm seed:load && pnpm perf:espacial
pnpm --filter @gis/api build
# API con todos los módulos, en producción y con el límite por IP alto (solo en local)
cd apps/api && FEATURE_...=true NODE_ENV=production JWT_SECRET=<32+ caracteres> LIMITE_POR_MINUTO=100000 \
  node --env-file=../../.env dist/main.js
k6 run -e BASE_URL=http://localhost:3000 -e VUS=4 -e PAUSA_S=4 -e SALIDA=resultado.json tools/carga/escenario-completo.js
k6 run -e BASE_URL=https://plataforma-gis-api.onrender.com -e VUS=4 -e PAUSA_S=7 -e DURACION=3m \
  -e SALIDA=resultado.json tools/carga/escenario-completo.js
BASE_URL=<url> CLIENTES=500 REPORTES=20 pnpm carga:difusion
```
