# Módulo `moderation`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

La cola de moderación y las decisiones de los moderadores, con su auditoría (HU-12 y HU-10). No cambia el reporte: emite `RechazoDeModeracion` y `reports` lo aplica.

## Modelo de dominio

| Elemento             | Tipo    | Qué hace                                                                                                                                |
| :------------------- | :------ | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `AccionDeModeracion` | Entidad | Registro inmutable de quién decidió qué sobre qué reporte. Todo rechazo lleva su motivo; mantener, uno opcional                         |
| `CasoDeModeracion`   | Entidad | Un reporte en la cola: negaciones, marca del clasificador y sus motivos. Sale al resolverse y vuelve con una negación o una marca nueva |
| `compararPrioridad`  | Función | Orden de revisión: lo marcado, lo más negado y lo más antiguo                                                                           |

## Casos de uso

| Clase                        | Qué hace                                                                                                                 |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `RechazarReporte`            | Rechaza un reporte vigente con motivo (Fase 5). Guarda la auditoría y `RechazoDeModeracion.v1`                           |
| `MantenerReporte`            | Deja publicado un reporte vigente; queda en la auditoría, sin evento (Fase 10)                                           |
| `ListarColaDeModeracion`     | Hasta 50 casos pendientes con su detalle y la descripción privada, solo vigentes (Fase 10)                               |
| `ActualizarColaDeModeracion` | Manejador de `VotoEmitido.v1` (negaciones), `ReporteClasificado.v1` (sospechosos) y los desenlaces del reporte (Fase 10) |

Las decisiones exigen el rol `MODERADOR`, que llega en la credencial. Toda decisión saca el reporte de la cola en la misma transacción que su auditoría.

## Eventos que emite

| Evento                   | Audiencia | Cuándo                          |
| :----------------------- | :-------- | :------------------------------ |
| `RechazoDeModeracion.v1` | Interna   | Un moderador rechaza un reporte |

## Eventos que escucha

`VotoEmitido.v1` (de `verification`), `ReporteClasificado.v1` (de `classifier`) y `ReporteRechazado.v1`, `ReporteResuelto.v1` y `ReporteCaducado.v1` (de `reports`).

## Puertos

| Puerto                        | Para qué                                                                                                                              |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `ConsultaDeReporte`           | Estado y detalle de los reportes (con la descripción privada y la ubicación pública). Lo conecta la raíz de composición con `reports` |
| `RepositorioDeCola`           | La cola de moderación                                                                                                                 |
| `UnidadDeTrabajoDeModeracion` | Guardar la auditoría, resolver el caso y guardar sus eventos en una transacción                                                       |

## Interfaz pública

`moderationModulo` en `index.ts`, junto con los casos de uso, el manejador y los adaptadores `RepositorioColaPg` y `UnidadDeTrabajoModeracionPg`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`acciones_moderacion` (auditoría) y `cola_moderacion` (cola). Columnas en `docs/diccionario-datos.md`.

## Interruptor

`FEATURE_MODERATION` (los módulos imprescindibles no tienen interruptor).

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`.
