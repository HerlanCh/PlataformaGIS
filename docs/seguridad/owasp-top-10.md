# Seguridad: OWASP Top 10, ZAP y dependencias (Fase 11)

Evidencia de la prueba 6 de la Fase 11 (ISO/IEC 25010, seguridad; RNF-13: 0 vulnerabilidades altas o críticas;
RNF-14: privacidad). Revisión del 2026-10-21 sobre `main` (`a13eeb4`) y la rama de este PR.

## 1. OWASP ZAP completo contra staging

El job `zap-completo` de `.github/workflows/zap.yml`, que se lanza a pedido con `gh workflow run ZAP`, hace lo
siguiente:
1. Registra un dispositivo de prueba.
2. Importa las 15 rutas del contrato OpenAPI (`/docs/json`, 26 URL con sus métodos).
3. Lanza el escaneo **activo** de `zaproxy/action-api-scan` con el token en cada solicitud, para atacar también las
   rutas autenticadas.

Va con un hilo y 300 ms entre solicitudes, para no chocar con el límite de 300 por minuto por IP.

### Staging (ejecución `39700973322`, 2026-10-22, 24 min)

| Riesgo | Hallazgos |
| :-- | :-- |
| **Alto** | **0** (cumple) |
| **Medio** | **0** |
| Bajo | «Unexpected Content-Type was returned» (22 casos), explicado abajo |
| Informativo | Respuestas 4xx esperadas, cabeceras `Sec-Fetch-*`, directivas de caché y un texto Base64 (el JWT) |

**122 reglas superadas**, entre ellas:
- inyección SQL (también por tiempo en PostgreSQL);
- XSS reflejado y persistente;
- inyección de comandos y SSI;
- recorrido de rutas;
- SSRF a metadatos de nube;
- divulgación de información.

**El hallazgo bajo no viene de la API.** Las 22 respuestas `text/html` las dio el **firewall de borde de Render**:
- **403 a los patrones de inyección SQL:** por ejemplo, `bbox=… AND 1=1 --`;
- **403 a un `Host` falso:** los ataques a `/latest/meta-data/` y `/computeMetadata/v1/`;
- **405 a métodos como `TRACE`.**

Con la misma ruta y una solicitud normal, la API responde `application/problem+json`. El CSV de datos abiertos
(`text/csv`) y Swagger UI (`/docs`, `text/html`) son los tipos que corresponden.

**Consecuencia:** en staging, parte de los ataques de inyección los detuvo Render antes de llegar a la API. Para medir
la API sola se repitió el escaneo en local, sin firewall de por medio.

### API local, sin firewall (2026-10-22)

`zap-api-scan.py` (imagen `ghcr.io/zaproxy/zaproxy:stable`) contra la API compilada de esta rama, con todos los
módulos activos y el mismo token. Dos hilos, sin pausa: en local el límite por IP está alto.

| Riesgo | Hallazgos |
| :-- | :-- |
| **Alto** | **0** (cumple) |
| **Medio** | **0** |
| Bajo | «Unexpected Content-Type» en 3 casos, los que corresponden: Swagger UI en `/docs` (`text/html`) y el CSV de datos abiertos (`text/csv`) |

Resultado:
- **122 reglas superadas**, ahora sin que nada las filtre antes.
- La API no registró **ningún error** durante el ataque: ningún 5xx; todo se respondió como 4xx en RFC 7807.

El baseline pasivo (`zap` en el mismo flujo) sigue corriendo tras cada versión; en esta ejecución también dio 0 altos.

## 2. Dependencias (`pnpm audit`)

| Alcance | Antes | Después | Compuerta |
| :-- | :-- | :-- | :-- |
| **Producción** (`--prod`) | 0 | **0** | Bloquea la CI (RNF-13). **Cumple** |
| Desarrollo | 5 altas, 3 moderadas, 2 bajas | 3 altas, 3 moderadas, 1 baja | Informativa |

En desarrollo se forzaron con `overrides` (`pnpm-workspace.yaml`) las dos altas que tenían versión corregida:
- `tmp` ≥ 0.2.6 (recorrido de rutas);
- `basic-ftp` ≥ 6.2.1 (denegación de servicio).

Ambas las usa Lighthouse CI. Las que quedan **no tienen parche publicado** y se aceptan como desviación justificada:

| Paquete | Severidad | Lo trae | Por qué no afecta al producto |
| :-- | :-- | :-- | :-- |
| `extract-zip` ≤ 2.0.1 (2 avisos) | Alta | `@lhci/cli` → `lighthouse` | Solo corre en la CI, para descomprimir el Chromium de Lighthouse desde su origen oficial. Nunca recibe archivos de terceros. |
| `braces` ≤ 3.0.3 | Alta | `semantic-release`, `plop` | Expande patrones escritos en la configuración del repositorio, nunca entradas externas. Solo corre en la CI y en el generador de módulos. |
| `uuid` < 11.1.1 | Moderada | `@lhci/cli` | El parche es un cambio de versión mayor dentro de Lighthouse CI. La función afectada (`v3`/`v5`/`v6` con búfer) no se usa. |
| `sprintf-js`, `esbuild` (2) | Moderada o baja | `@lhci/cli`, `drizzle-kit`, `tsup` | Herramientas de compilación locales; el servidor de desarrollo de esbuild no se usa. |

Ninguna de estas dependencias llega al bundle de la PWA ni al proceso de la API. Dependabot (`.github/dependabot.yml`)
propone las actualizaciones cuando aparezcan.

## 3. Revisión manual del OWASP Top 10 (2021)

| Riesgo | Controles en el sistema | Evidencia | Resultado |
| :-- | :-- | :-- | :-- |
| **A01 Control de acceso roto** | Cada ruta de escritura exige un JWT. El rol `MODERADOR` va en el token y lo verifica el caso de uso. Solo se puede borrar una zona o una suscripción propia. El autor no vota su propio reporte. El rol solo se asigna por script (`pnpm moderador:ascender`), sin ruta HTTP. | `HU-12: un ciudadano no puede rechazar (403); un moderador sí (202)`, `HU-07: … la de otro usuario es 403`, `HU-08: borra solo la suscripción propia`, `HU-03: el autor no puede votar su propio reporte` | Cumple |
| **A02 Fallas criptográficas** | HTTPS en Render y Vercel. JWT HS256 con el algoritmo fijado al verificar (sin `none`), clave de al menos 32 caracteres exigida en producción, rotación con clave anterior y expiración. Web Push cifrado con VAPID. Respaldo cifrado con AES-256. La identidad es un hash del dispositivo, sin contraseñas. | `http.test.ts` (`ServicioDeTokens`, `cargarConfigHttp`), `docs/operacion/respaldo.md` | Cumple |
| **A03 Inyección** | Toda entrada pasa por esquemas Zod. Las consultas usan Drizzle y plantillas `sql` con parámetros; los dos `sql.raw` solo interpolan constantes del código (zona horaria y nombre de la tabla de migraciones). El CSV de datos abiertos solo lleva valores controlados (categoría, celda, hora y estado), nunca texto de personas. La API solo responde JSON con `default-src 'none'`. | `api.integration.test.ts` (`ENTRADA_INVALIDA`), ZAP activo (inyección SQL, XSS y comandos) | Cumple |
| **A04 Diseño inseguro** | Límites por IP (300/min) y por usuario (5 reportes y 30 votos cada 10 min), idempotencia de los reportes, reputación y silenciado de autores, moderación con auditoría y clasificador de spam. | `HU-01: el sexto reporte en 10 minutos se rechaza indicando cuánto esperar`, `al superar el límite por IP responde 429 en formato RFC 7807`, pruebas 3.2 y 3.3 de `docs/rendimiento/tolerancia-fallos.md` | Cumple |
| **A05 Configuración insegura** | Helmet (CSP `default-src 'none'`, `frame-ancestors 'none'`, CORP `same-site`), CORS limitado al origen de la PWA, errores RFC 7807 sin detalles internos (también con la base caída), cuerpo acotado (413). | ZAP baseline tras cada versión; `un error inesperado es 500 y no revela su mensaje` | Cumple; ver hallazgos medios de `/docs` en la sección 1 |
| **A06 Componentes vulnerables** | `pnpm audit --prod` bloquea la CI, Dependabot y lockfile congelado (`--frozen-lockfile`). | Sección 2 | Cumple en producción |
| **A07 Fallas de identificación** | Identidad anónima por dispositivo: no hay contraseñas que adivinar. Tokens con expiración y firma verificada; un token vencido o mal firmado da 401. Límite por IP en el registro. | `rechaza un token firmado con una clave que no conoce`, `TOKEN_VENCIDO` | Cumple |
| **A08 Integridad de software y datos** | Dependencias fijadas en el lockfile y verificadas por pnpm (*supply-chain policies*). Scripts de instalación solo para `esbuild` (`allowBuilds`). Versiones con semantic-release desde `main` protegida. Eventos validados con Zod y versionados. | `pnpm-workspace.yaml`, `.github/workflows/release.yml` | Cumple |
| **A09 Registro y monitoreo** | Logs JSON de pino con ID de correlación (`x-request-id`) en cada respuesta y en cada error. Fastify no registra cabeceras, así que los tokens no llegan a los logs. UptimeRobot vigila `/health` cada 5 minutos. | `docs/rendimiento/difusion-staging.md` (UptimeRobot) | Cumple |
| **A10 SSRF** | **Defecto corregido en este PR.** El único destino saliente elegido por un cliente es el `endpoint` de su suscripción Web Push. Antes solo se exigía `https`: se podía registrar `https://localhost:5432/` o una IP privada y la API le enviaba un `POST` en cada reporte de la zona. Ahora el dominio solo acepta los servicios push de los navegadores (FCM, Mozilla, WNS y Apple), en el puerto por defecto. | `rechaza un endpoint en la máquina local`, `… en una IP privada`, `… un dominio que imita a un servicio push`, `… con otro puerto` y `HU-08: acepta el servicio push de Chrome/Firefox/Edge/Safari` | Cumple tras la corrección |

### Privacidad (RNF-14)

Las respuestas públicas nunca llevan `location` real, `author_id` ni la descripción privada. Lo verifican:
- la prueba de privacidad sobre todas las rutas;
- las audiencias de los eventos en `contracts`;
- la anonimización de los datos abiertos (`HU-11: la tabla no tiene columnas de usuario, punto, descripción ni ID`).

## Defectos encontrados

| Defecto | Severidad | Estado |
| :-- | :-- | :-- |
| SSRF ciego por el `endpoint` de Web Push (A10) | Media: el atacante no ve la respuesta, pero puede hacer que la API envíe solicitudes a la red interna | Corregido en este PR, con prueba primero |
| 2 dependencias de desarrollo altas con parche | Alta, solo en herramientas de la CI | Corregido con `overrides` |
