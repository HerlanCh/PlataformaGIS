# Módulo `subscriptions`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Guardar las zonas de interés de cada usuario: un círculo (centro y radio) y las categorías de incidentes que quiere recibir en él.

También decide a quién avisar de un reporte nuevo. El envío lo hace el adaptador de `EnviadorDeNotificaciones`: desde la Fase 8, Web Push con el módulo `notifications` (o el log, si está apagado); Telegram llega en la Fase 9.

## Modelo de dominio

| Elemento       | Tipo    | Qué hace                                                                                                                       |
| :------------- | :------ | :----------------------------------------------------------------------------------------------------------------------------- |
| `ZonaSuscrita` | Entidad | Zona inmutable: dueño, centro, radio entero entre 100 m y 2000 m y al menos una categoría. Para cambiarla se elimina y se crea |

## Casos de uso (Fase 5)

| Clase                   | Qué hace                                                                                                                                                                                  |
| :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SuscribirZona`         | Crea una zona (HU-07): como máximo 5 por usuario                                                                                                                                          |
| `EliminarZona`          | Elimina una zona propia (HU-07)                                                                                                                                                           |
| `NotificarSuscriptores` | Manejador de `ReporteCreado` v1 y v2 (HU-08): avisa una vez por persona, nunca al autor, con la ubicación pública. No escucha `ReporteConfirmado`, así cada reporte se avisa una sola vez |

## Eventos que emite

_Ninguno._

## Eventos que escucha

| Evento                     | Qué hace                                           |
| :------------------------- | :------------------------------------------------- |
| `ReporteCreado.v1` y `.v2` | Avisa a los suscriptores de la zona y la categoría |

## Puertos

| Puerto                       | Para qué                                                                                                                    |
| :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `RepositorioDeSuscripciones` | Guardar, eliminar y leer las zonas, por ID o por su usuario; buscar las zonas que contienen un punto (`buscarSuscriptores`) |
| `ConsultaDeAutor`            | Autor de un reporte, para no avisarle. Lo conecta la raíz de composición con `reports`                                      |
| `EnviadorDeNotificaciones`   | Canal de salida de los avisos                                                                                               |

## Interfaz pública

`subscriptionsModulo` en `index.ts`, junto con los casos de uso, el manejador y el adaptador `RepositorioSuscripcionesPg`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`zonas_suscritas`. Columnas, índices y restricciones en `docs/diccionario-datos.md`.

`id_usuario` y `categorias` guardan identificadores de `identity` y de `reports` sin clave foránea.

## Interruptor

`FEATURE_SUBSCRIPTIONS` (los módulos imprescindibles no tienen interruptor). Apagado, sus migraciones no se aplican y su tabla no existe.

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
