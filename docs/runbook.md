# Runbook de producción

Cómo desplegar, revertir, restaurar y mantener Alerta LP en producción (roadmap 12). Todo pasa por GitHub Actions:
nadie despliega a mano ni guarda cadenas de conexión en su máquina.

## Mapa de entornos

| | Staging | Producción |
| :-- | :-- | :-- |
| Web | `plataformagis-apps.vercel.app` (proyecto `plataformagis-apps`) | `plataforma-gis-produccion.vercel.app` (proyecto `plataforma-gis-produccion`, **sin repositorio conectado**) |
| API | `plataforma-gis-api.onrender.com` | `plataforma-gis-api-produccion.onrender.com` (`srv-dbdoi159el5s73f8e0kg`) |
| Base | Neon, proyecto de staging | Neon, proyecto `plataforma-gis-produccion` |
| Cómo se despliega | Solo, al llegar a `main` (integraciones de Render y Vercel) | Workflow `Produccion`, con aprobación manual |
| Migraciones | Al arrancar la API | Paso del pipeline, antes de desplegar la API |
| Environment de GitHub | `staging` | `produccion` (con revisor) y `produccion-respaldo` (sin revisor, solo respaldo) |

Ambas APIs se definen en el Blueprint **GIS** de Render (`render.yaml`).

### Secretos y variables de producción

| Dónde | Nombre | Contenido |
| :-- | :-- | :-- |
| Environment `produccion` | `DATABASE_URL` | Cadena **directa** de Neon (sin `-pooler`), para migrar |
| | `RENDER_API_KEY` | API key de Render (Account Settings → API Keys) |
| | `VERCEL_TOKEN` | Token de Vercel con scope de todo el equipo, no de un proyecto |
| | `HUMO_HASH_DISPOSITIVO` | Hash aleatorio del usuario de humo |
| | Variables `API_URL`, `WEB_URL`, `RENDER_SERVICE_ID`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SENTRY_DSN_WEB` | No son secretas |
| Environment `produccion-respaldo` | `DATABASE_URL`, `BACKUP_PASSPHRASE` | Ver [respaldo](operacion/respaldo.md) |
| Servicio de Render | `DATABASE_URL` | Cadena **con `-pooler`** de Neon |
| | `JWT_SECRET` | Al menos 32 caracteres, distinta de staging |
| | `CORS_ORIGIN` | `https://plataforma-gis-produccion.vercel.app` |
| | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Claves de Web Push propias de producción |
| | `SENTRY_DSN` | DSN del proyecto `api` de GlitchTip (no es secreto) |
| | `HUMO_ID_USUARIO` | Id del usuario de humo (lo da el workflow `Administracion`) |

## Desplegar

1. Se fusiona un PR en `main`. Si sus commits lo ameritan (`feat`, `fix`…), `Release` publica `vX.Y.Z`.
2. El workflow `Produccion` encuentra la etiqueta y **espera la aprobación** del environment `produccion`. En la
   ejecución: *Review deployments* → `produccion` → *Approve and deploy*.
3. El job hace, en orden:
   1. **Migraciones** contra la base de producción, en el código de la etiqueta.
   2. **API:** pide a Render el commit exacto y espera a que `/health` lo sirva (hasta 20 min; el plan gratuito
      tarda en arrancar).
   3. **Web:** ajusta la CSP a la API de producción (`tools/despliegue/csp.mjs`), construye y publica en Vercel.
   4. **Prueba de humo** (`pnpm humo`): `/health`, crear un reporte, leerlo, recibirlo por WebSocket y rechazarlo.
4. El resumen de la ejecución muestra la versión, la API y la web.

Si falla un paso, los siguientes no corren. Una migración que falla deja la versión anterior funcionando: por eso
las migraciones son solo de avance compatible (ver abajo).

**Una ejecución sin aprobar bloquea la cola.** Todas las ejecuciones de `Produccion` comparten un grupo de
concurrencia. Mientras una espera aprobación, la siguiente queda en *pending*. Apruébala o cancélala con
`gh run cancel <id>`.

**Volver a intentar un despliegue fallido:** lanza `gh workflow run Produccion -f version=vX.Y.Z`. No uses
*Re-run*: repite el workflow con el que corrió la primera vez, aunque ya se haya corregido en `main`.

## Revertir a la versión anterior

1. Busca la versión anterior: `gh release list --limit 5`.
2. Lanza el despliegue de esa versión y aprueba la ejecución:

   ```
   gh workflow run Produccion -f version=vX.Y.Z
   ```

   Despliega la API y la web de esa etiqueta y corre la prueba de humo. Las migraciones de esa versión ya están
   aplicadas, así que el paso no cambia nada.
3. Comprueba que `/health` responda con el commit de la etiqueta: `git rev-parse vX.Y.Z^{commit}`.

**La base no se revierte.** Revertir la API no deshace migraciones: la versión anterior funciona sobre el esquema
nuevo porque las migraciones solo agregan. Si hiciera falta deshacer datos, se
[restaura un respaldo](#restaurar-un-respaldo).

**Si GitHub Actions no está disponible**, como último recurso:
- **API:** en el panel de Render, el servicio de producción → *Events* → el despliegue anterior → *Rollback*.
- **Web:** `vercel rollback --token …` o, en el panel de Vercel, *Deployments* → el anterior → *Promote to Production*.

Anótalo en `docs/bitacora.md`: fue un cambio fuera del pipeline.

## Reglas de las migraciones

Las migraciones de avance solo agregan: tablas, columnas que admiten nulos o tienen valor por defecto, e índices. La
CI lo verifica con `tools/migraciones/verificar-compatibles.mjs`.

Para quitar o renombrar algo se usan dos versiones:
1. **Versión N:** se agrega lo nuevo y el código deja de usar lo viejo.
2. **Versión N+1** (con N ya en producción): se quita lo viejo, con un comentario `-- compatible: <razón>` en la
   sentencia.

Nunca se borra ni se renombra algo que la versión desplegada todavía lee.

## Restaurar un respaldo

El procedimiento completo está en [operacion/respaldo.md](operacion/respaldo.md#restaurar-a-mano). En producción:

1. Descarga el artefacto `respaldo-produccion-<id>` de la última ejecución verde de `Respaldo`.
2. Descífralo con la frase de producción, que está en el gestor de contraseñas del responsable.
3. Restaura en una base nueva de Neon, en un *branch* o en un proyecto nuevo, y compara los conteos.
4. Apunta a la base restaurada:
   - `DATABASE_URL` de Render, con la cadena con `-pooler`;
   - los secretos `DATABASE_URL` de los environments `produccion` y `produccion-respaldo`, con la cadena directa.
5. Vuelve a desplegar la versión actual con `gh workflow run Produccion -f version=<actual>`. Así se aplican las
   migraciones que falten y pasa la prueba de humo.

## Rotar secretos

Rota todos los secretos si alguno se expuso (por ejemplo, si se pegó en un chat o en un issue) y, como rutina, una
vez al año.

| Secreto | Cómo rotarlo | Efecto en los usuarios |
| :-- | :-- | :-- |
| `JWT_SECRET` | En Render: pasar el valor actual a `JWT_SECRET_ANTERIOR`, poner uno nuevo en `JWT_SECRET` y desplegar. Tras `JWT_DURACION_S` (24 h), borrar `JWT_SECRET_ANTERIOR`. | Ninguno: los tokens viejos valen hasta que vencen. |
| Contraseña de Neon | En Neon: *Roles* → *Reset password*. Actualizar `DATABASE_URL` en Render y en los environments `produccion` y `produccion-respaldo`. | La API se corta hasta que Render tiene la cadena nueva. |
| `RENDER_API_KEY` | Crear una nueva en Render, `gh secret set RENDER_API_KEY --env produccion` y borrar la vieja. | Ninguno. |
| `VERCEL_TOKEN` | Crear uno con scope del equipo, `gh secret set VERCEL_TOKEN --env produccion` y borrar el viejo. Si vence, el paso de la web falla. | Ninguno. |
| `BACKUP_PASSPHRASE` | Ver [respaldo](operacion/respaldo.md#secretos). Guardar la nueva en el gestor de contraseñas **antes** de cargarla. | Ninguno; los respaldos viejos siguen necesitando la frase vieja. |
| Claves VAPID | `npx web-push generate-vapid-keys`, cargarlas en Render y desplegar. | **Se pierden todas las suscripciones a avisos:** cada persona debe volver a activarlos. Solo si la privada se filtró. |
| `HUMO_HASH_DISPOSITIVO` | Nuevo valor aleatorio en el environment y luego `Administracion` → `preparar-usuario-de-humo`; actualizar `HUMO_ID_USUARIO` en Render. | Ninguno. |

## Usuario moderador y usuario de humo

Las categorías se siembran con las migraciones. Los usuarios se preparan con el workflow `Administracion`, que corre
contra la base del entorno elegido. En producción pide aprobación.

- **Moderador:** la persona abre `/moderacion` en la PWA y copia su id. Luego:

  ```
  gh workflow run Administracion -f entorno=produccion -f accion=ascender-moderador -f id_usuario=<id>
  ```

  El rol le llega al volver a abrir `/moderacion`.
- **Usuario de humo** (una vez por entorno, o tras rotar su hash):

  ```
  gh workflow run Administracion -f entorno=produccion -f accion=preparar-usuario-de-humo
  ```

  El resumen de la ejecución muestra su id. Ese id va en `HUMO_ID_USUARIO` en Render, y la API lo toma en el
  siguiente despliegue. Sus reportes no avisan a nadie, no entran en los datos abiertos ni cambian su reputación.

## Monitoreo

- **UptimeRobot** (plan gratuito, cada 5 min, alerta por correo):
  - `https://plataforma-gis-api-produccion.onrender.com/health`, que responde `503` si la base no está disponible;
  - `https://plataforma-gis-produccion.vercel.app`.

  El ping a la API también evita que Render la duerma (RSK-01).
- **Errores de la aplicación:** GlitchTip (app.glitchtip.com, plan gratuito de 1.000 eventos al mes).
  - Proyecto `api`: recibe los 5xx inesperados y las promesas rechazadas sin manejar. El DSN va en `SENTRY_DSN` de
    Render.
  - Proyecto `web`: recibe los errores no atrapados de la PWA. El DSN va en la variable `SENTRY_DSN_WEB` del
    environment `produccion`, y el pipeline lo agrega al build y a la CSP.
  - El envío no usa el SDK de Sentry: lo hace `packages/errores-remotos`, con el mismo protocolo. Todo pasa por
    `sinDatosPersonales`, que quita ids, coordenadas y parámetros de URL. Se envía la ruta como patrón
    (`GET /v1/reportes/:id`), nunca la URL.
  - Staging no envía errores: no tiene DSN.

## Si un plan gratuito se suspende o se agota (RSK-02)

| Proveedor | Señal | Qué hacer |
| :-- | :-- | :-- |
| **Render** | El servicio queda *suspended* o no arranca a fin de mes. Las horas de instancia gratuitas se comparten entre staging y producción, y el ping de UptimeRobot mantiene despierta la de producción. | Suspender el servicio de **staging** en el panel hasta el mes siguiente: producción tiene prioridad. Si se repite, plantear un ADR para mover la API a Oracle Cloud Always Free. |
| **Neon** | Errores de conexión o *compute time exceeded*; la API responde `503` en `/health`. | Revisar en Neon el consumo del mes. Bajar el uso de staging (suspender su API). Si no basta, restaurar el último respaldo en otro proyecto de Neon o en otro proveedor gratuito con PostGIS, y seguir [Restaurar un respaldo](#restaurar-un-respaldo). |
| **Vercel** | Despliegues bloqueados o la web no carga. | La web es estática: se puede publicar `apps/web/dist` en otro hosting gratuito (por ejemplo, Cloudflare Pages) con un ADR, y actualizar `CORS_ORIGIN` y `WEB_URL`. |
| **GitHub Actions** | Sin minutos o sin servicio. | El repositorio es público: los minutos son ilimitados. Si GitHub cae, no se despliega; para urgencias, ver [Revertir](#revertir-a-la-versión-anterior). |

En todos los casos se deja registro en `docs/bitacora.md` y, si cambia un proveedor, un ADR nuevo en `docs/adr/`.
