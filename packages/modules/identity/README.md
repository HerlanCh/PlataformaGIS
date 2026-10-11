# Módulo `identity`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

_Por definir._

## Eventos que emite

_Ninguno todavía._

## Eventos que escucha

_Ninguno todavía._

## Interfaz pública

`identityModule` en `index.ts`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

_Ninguna todavía._

## Interruptor

`FEATURE_IDENTITY` (los módulos imprescindibles no tienen interruptor).

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
