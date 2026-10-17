# Módulo `moderation`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Decisiones de los moderadores sobre los reportes y su auditoría (HU-12). No cambia el reporte: emite `RechazoDeModeracion` y `reports` lo aplica.

## Modelo de dominio

| Elemento             | Tipo    | Qué hace                                                                                |
| :------------------- | :------ | :-------------------------------------------------------------------------------------- |
| `AccionDeModeracion` | Entidad | Registro inmutable de quién decidió qué sobre qué reporte. Todo rechazo lleva su motivo |

## Casos de uso (Fase 5)

`RechazarReporte`: solo con rol `MODERADOR` (el rol llega de la credencial) y sobre un reporte vigente. Guarda la auditoría y `RechazoDeModeracion.v1` en una transacción; después `reports` lo pasa a `RECHAZADO` y `verification` resta 0,50 al autor.

## Eventos que emite

| Evento                   | Audiencia | Cuándo                          |
| :----------------------- | :-------- | :------------------------------ |
| `RechazoDeModeracion.v1` | Interna   | Un moderador rechaza un reporte |

## Eventos que escucha

_Ninguno._

## Puertos

| Puerto                        | Para qué                                                              |
| :---------------------------- | :-------------------------------------------------------------------- |
| `ConsultaDeReporte`           | Estado de un reporte. Lo conecta la raíz de composición con `reports` |
| `UnidadDeTrabajoDeModeracion` | Guardar la auditoría y sus eventos en una transacción                 |

## Interfaz pública

`moderationModulo` en `index.ts`, junto con `RechazarReporte` y el adaptador `UnidadDeTrabajoModeracionPg`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`acciones_moderacion`: auditoría de quién decidió qué sobre qué reporte y por qué. Columnas y restricciones en `docs/diccionario-datos.md`. La cola de moderación (leer reportes marcados y negados) llega en la Fase 10.

## Interruptor

`FEATURE_MODERATION` (los módulos imprescindibles no tienen interruptor).

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
