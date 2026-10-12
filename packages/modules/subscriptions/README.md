# Módulo `subscriptions`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Guardar las zonas de interés de cada usuario: un círculo (centro y radio) y las categorías de incidentes que quiere recibir en él.

No envía notificaciones: eso es del módulo `notifications`. Por ahora solo existe el modelo y su persistencia; los casos de uso (crear, eliminar, límite de 5 zonas por usuario) y la búsqueda de zonas que contienen un punto llegan en fases posteriores.

## Modelo de dominio

| Elemento           | Tipo    | Qué hace                                                                                                                       |
| :----------------- | :------ | :----------------------------------------------------------------------------------------------------------------------------- |
| `ZoneSubscription` | Entidad | Zona inmutable: dueño, centro, radio entero entre 100 m y 2000 m y al menos una categoría. Para cambiarla se elimina y se crea |

## Eventos que emite

_Ninguno todavía._

## Eventos que escucha

_Ninguno todavía._

## Puertos

| Puerto                   | Para qué                                                    |
| :----------------------- | :---------------------------------------------------------- |
| `SubscriptionRepository` | Guardar, eliminar y leer las zonas, por ID o por su usuario |

## Interfaz pública

`subscriptionsModule` en `index.ts`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`zone_subscriptions`. Columnas, índices y restricciones en `docs/diccionario-datos.md`.

`user_id` y `categories` guardan identificadores de `identity` y de `reports` sin clave foránea.

## Interruptor

`FEATURE_SUBSCRIPTIONS` (los módulos imprescindibles no tienen interruptor). Apagado, sus migraciones no se aplican y su tabla no existe.

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
