# Tolerancia a fallos

Evidencia de la prueba 3 de la Fase 11 (ISO/IEC 25010: fiabilidad, tolerancia a fallos).

## 3.1 Base de datos detenida 60 s

**Criterio:** la API responde `503` con `application/problem+json`, no se cae y se recupera sola.

### Defecto encontrado y corregido

Antes de la Fase 11, una consulta con la base caída terminaba en el manejador genérico de errores y salía como
`500 ERROR_INTERNO`. Ahora `esBaseDeDatosNoDisponible` (`packages/platform/src/errores-pg.ts`) reconoce los errores de
conexión de `pg`, también cuando Drizzle los envuelve en `cause`:
- códigos de red: `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT` y `ENOTFOUND`;
- SQLSTATE de clase `08`, `57P01` a `57P03` y `53300`;
- tiempo agotado del pool y conexión cortada.

La API los traduce a `503 BASE_DE_DATOS_NO_DISPONIBLE` con `retry-after: 5`, sin revelar el detalle de la conexión.

### Pruebas automáticas

- `apps/api/src/base-caida.integration.test.ts`:
  1. levanta PostGIS con Testcontainers y consulta con Drizzle;
  2. detiene el contenedor;
  3. exige `503`, `problem+json`, `retry-after` y ningún rastro de la conexión en el cuerpo.
- `apps/api/src/http/http.test.ts` y `packages/platform/src/platform.test.ts`: cada tipo de error de conexión da
  `503`, y un error de SQL que no es de conexión sigue dando `500`.

### Prueba manual (2026-10-20)

Entorno:
- API compilada (`node dist/main.js`) contra el PostGIS de `docker compose`.
- Un sondeo cada 5 s a `/health` y a `GET /v1/reportes`.
- `docker compose stop db` en el segundo 11 y `docker compose start db` en el 72.

| Tramo | `/health` | `GET /v1/reportes` |
| :-- | :-- | :-- |
| 0 a 5 s | `200 ok` | `200` |
| 11 a 66 s (base detenida, 12 sondeos) | `503 degraded` | `503 application/problem+json BASE_DE_DATOS_NO_DISPONIBLE`, entre 3 y 18 ms |
| 72 a 117 s | `200 ok` | `200` |

Resultado:
- **El proceso no se cayó:** 0 registros fatales.
- **Recuperación sin intervención:** volvió a `200` en el primer sondeo tras levantar la base.
- El despachador del outbox y la tarea de caducidad registraron sus pasadas fallidas («falló una pasada del despachador»,
  «falló una tarea») y siguieron en el siguiente ciclo. **Cumple.**

En staging, el `healthCheckPath` de Render ve el `503` de `/health`. Si la caída se prolonga, Render puede reiniciar la
instancia; al volver la base, la API arranca igual que en un despliegue.

## 3.2 Reinicio de la API con reportes en vuelo

**Criterio:** 0 eventos perdidos.

`pnpm fiabilidad:reinicio` (`apps/api/src/rendimiento/fiabilidad-reinicio.ts`), contra la API compilada y la base
local:
1. Lanza 60 `POST /v1/reportes` a la vez, de 20 dispositivos, en puntos separados unos 1,1 km.
2. Al llegar la respuesta número 15, mata la API con `SIGKILL`: sin apagado ordenado, con solicitudes a medio
   procesar.
3. Levanta la API de nuevo y reenvía las 60 solicitudes con su misma clave de idempotencia, como la cola de la PWA
   con lo que quedó sin respuesta. Las que sí se respondieron también se reenvían: así se comporta un cliente que no
   llegó a ver la respuesta.
4. Espera a que el outbox no tenga pendientes. `evaluarReinicio` (`fiabilidad.ts`, con pruebas unitarias) cruza lo que
   vio el cliente con la base.

Ejecución del 2026-10-20, tres corridas:

| Corrida | Respondidos antes de la caída | Guardados sin respuesta | Reportes perdidos | Reportes duplicados | Reenvíos con otro reporte | Eventos perdidos | Eventos duplicados |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | 15 de 60 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 15 de 60 | **1** | 0 | 0 | 0 | 0 | 0 |
| 3 | 15 de 60 | 0 | 0 | 0 | 0 | 0 | 0 |

- **Corrida 2:** se dio el caso difícil. Un reporte quedó guardado sin que el cliente recibiera la respuesta, porque
  la API murió entre el `COMMIT` y la escritura. El reenvío devolvió el mismo reporte y no creó otro.
- **Eventos:** cada `ReporteCreado.v1` se guarda en la misma transacción que el reporte. Los que la API no alcanzó a
  publicar los entregó el despachador al arrancar. **Cumple.**

La prueba automática `packages/platform/src/despachador.integration.test.ts` («fiabilidad») cubre lo mismo en cada CI.

## 3.3 Corte de red del cliente durante un envío

**Criterio:** 0 reportes perdidos ni duplicados.

Prueba Playwright `HU-05: si la red se corta durante el envío, el reporte llega una sola vez`
(`apps/web/e2e/historias.spec.ts`):
1. El primer `POST /v1/reportes` llega a la API, que guarda el reporte (`CREADO`). La respuesta se corta con
   `connectionreset` y nunca llega al teléfono.
2. La PWA lo deja en su cola: «1 reporte pendiente de envío».
3. Al volver la señal, la cola lo reenvía con la misma clave. La API repite su respuesta original (mismo `resultado`
   y mismo `id`) y la cola queda vacía.
4. La API tiene exactamente un reporte en ese punto, también 2 s después.

**Control de la prueba:** con un reenvío sin la clave original, la API responde `PROPIO_EXISTENTE` (su detección de
duplicados del mismo autor) y la prueba falla. Así se comprobó que la prueba verifica la idempotencia y no solo la
deduplicación espacial. **Cumple** en local. En staging corre con la regresión de `e2e.yml`.
