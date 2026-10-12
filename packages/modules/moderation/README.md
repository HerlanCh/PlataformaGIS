# Módulo `moderation`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

_Por definir._

## Eventos que emite

_Ninguno todavía._

## Eventos que escucha

_Ninguno todavía._

## Interfaz pública

`moderationModule` en `index.ts`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`acciones_moderacion`: auditoría de quién decidió qué sobre qué reporte y por qué. Columnas y restricciones en `docs/diccionario-datos.md`. Su dominio y su repositorio llegan en la Fase 10.

## Interruptor

`FEATURE_MODERATION` (los módulos imprescindibles no tienen interruptor).

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
