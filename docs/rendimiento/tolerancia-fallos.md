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
