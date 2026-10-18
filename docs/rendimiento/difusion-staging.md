# Difusión en tiempo real y caducidad en staging

Evidencia del criterio de salida de la Fase 7 (ISO/IEC 25010: eficiencia RNF-10 y fiabilidad).

## Entorno

- **API:** `https://plataforma-gis-api.onrender.com`, plan gratuito de Render (región Virginia), versión `v2.4.0` (commit `7be36db`).
- **Base de datos:** Neon con PostgreSQL 18 y PostGIS 3.6, con la migración `0002_entrega_de_eventos` aplicada al arrancar.
- **Servidor despierto:** un monitor de UptimeRobot llama a `/health` cada 5 minutos.
- **Clientes:** `pnpm carga:difusion` desde la máquina de desarrollo. Cada evento cruza internet hasta Virginia y vuelve, así que la latencia incluye el viaje de red.

## Difusión con 500 clientes (RNF-10: p95 < 2 s)

Ejecución del 2026-10-17T23:03Z:
- 500 clientes Socket.io autenticados con JWT, repartidos en 10 zonas de la ciudad separadas unos 3 km (50 por zona). Cada cliente escucha las salas de su ventana.
- Se crearon 20 reportes, 2 por zona y uno cada 3 s.
- La latencia se mide desde que se envía el `POST /v1/reportes` hasta que el evento `ReporteCreado` llega a cada cliente de su zona. Incluye el guardado, el outbox, la pasada del despachador (cada 250 ms) y la emisión por la sala.

| Medida | Valor |
| :--- | ---: |
| Entregas esperadas | 1000 |
| Entregas recibidas | 1000 (100 %) |
| Entregas a clientes de otra zona | 0 |
| p50 | 404 ms |
| **p95** | **524 ms** (cumple) |
| Máximo | 664 ms |

Comando:

```
BASE_URL=https://plataforma-gis-api.onrender.com CLIENTES=500 REPORTES=20 pnpm carga:difusion
```

## Fiabilidad ante un reinicio (0 eventos perdidos)

Lo demuestra la prueba automática `packages/platform/src/despachador.integration.test.ts` ("fiabilidad"), que corre en cada CI:
1. Los eventos quedan guardados en el outbox sin publicar, como si el proceso hubiera muerto justo después de guardar.
2. Un despachador nuevo, como tras el reinicio, los entrega todos.

En staging el reinicio ocurre en cada despliegue de Render; los eventos pendientes se entregan al arrancar.

## Caducidad automática

Se creó un reporte de `jauria` (TTL de 120 min) con un cliente WebSocket escuchando su celda:
- **Reporte:** `c8a5e5f3-1aec-4309-bf59-1075b9470880`, creado el 2026-10-17T23:01:24Z, caduca el 2026-10-18T01:01:24Z.
- **`ReporteCreado`:** llegó al cliente en unos 270 ms.
- **`ReporteCaducado`:** llegó al mismo cliente por WebSocket a las 01:04:20 de su reloj local. Ese reloj iba unos 2 min 18 s adelantado respecto del servidor (según `creadoEn` y la respuesta), así que llegó hacia las 01:02:02 del servidor, menos de un minuto después del vencimiento. Cuadra con la tarea `CaducarReportes`, que corre cada 60 s. **Cumple.**

Nadie intervino entre la creación y la caducidad: la tarea programada pasó el reporte a `CADUCADO`, el despachador entregó el evento y Socket.io lo difundió a la celda.
