# Módulo `notifications`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Entregar los avisos de las zonas suscritas por Web Push (HU-08): guardar a qué dispositivos enviarlos y enviarlos firmados con claves VAPID. Qué avisar y a quién lo decide `subscriptions`; la raíz de composición conecta los dos módulos (ADR-001).

Un aviso solo lleva el ID del reporte, su categoría y su `public_location`: nunca el autor ni la ubicación real.

## Modelo de dominio

| Elemento          | Tipo    | Qué hace                                                                                               |
| :---------------- | :------ | :----------------------------------------------------------------------------------------------------- |
| `SuscripcionPush` | Entidad | Dispositivo de un usuario: `endpoint` https y las claves `p256dh` y `auth` en base64 de URL. Inmutable |

## Casos de uso (Fase 8)

| Clase                      | Qué hace                                                                                                                                                                                                    |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RegistrarSuscripcionPush` | Alta del dispositivo; idempotente por `endpoint`, que pasa al usuario actual                                                                                                                                |
| `EliminarSuscripcionPush`  | Baja de un dispositivo propio; idempotente                                                                                                                                                                  |
| `EnviarAvisoPush`          | Envía un aviso a todos los dispositivos del usuario. Un 404 o 410 borra la suscripción vencida; los demás fallos se cuentan y no se lanzan, para que el manejador del evento no repita avisos ya entregados |

## Eventos que emite

_Ninguno._

## Eventos que escucha

_Ninguno directamente._ El aviso nace en `NotificarSuscriptores` (`subscriptions`, al recibir `ReporteCreado`); la raíz de composición lo envía con `EnviarAvisoPush`.

## Puertos

| Puerto                           | Para qué                                                                            |
| :------------------------------- | :---------------------------------------------------------------------------------- |
| `RepositorioDeSuscripcionesPush` | Guardar (reemplazando por `endpoint`), listar por usuario y eliminar por `endpoint` |
| `EmisorPush`                     | Canal Web Push. Lanza `ErrorSuscripcionVencida` ante un 404 o 410                   |

## Adaptadores

| Adaptador                        | Qué hace                                                                                                   |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `RepositorioSuscripcionesPushPg` | Tabla `suscripciones_push` con Drizzle                                                                     |
| `EmisorWebPush`                  | Librería `web-push` con `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`. Vigencia del aviso: 2 h |

## Rutas (en `apps/api`)

`GET /v1/notificaciones/clave-publica` (pública), `POST` y `DELETE /v1/notificaciones/push` (con token).

## Interfaz pública

`notificationsModulo` en `index.ts`, junto con los casos de uso y los adaptadores. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`suscripciones_push`. Columnas e índices en `docs/diccionario-datos.md`. `id_usuario` guarda el ID de `identity` sin clave foránea.

## Interruptor

`FEATURE_NOTIFICATIONS`. Apagado, o sin las dos claves VAPID, las rutas no existen (404) y los avisos de las zonas solo quedan en el log.

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
