# Módulo `verification`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Registrar los votos de la comunidad ("¿Sigue ahí?"), decidir cuándo un reporte debe confirmarse, extenderse o resolverse, y mantener la reputación de cada usuario.

Nunca modifica un reporte: emite su decisión y el módulo `reports` la aplica.

## Modelo de dominio

| Elemento                 | Tipo          | Qué hace                                                                                                                                  |
| :----------------------- | :------------ | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `Voto`                   | Entidad       | Confirmación o negación con el peso del votante. Reglas: el autor no vota, un voto por usuario, votante a 1000 m o menos, reporte vigente |
| `Reputacion`             | Entidad       | Puntuación entre 0 y 5. En 0 el usuario está silenciado; se recupera a 0.5 tras 30 días sin penalización                                  |
| `PoliticaDeVerificacion` | Política pura | Decide `CONFIRMAR` (3.0 y 2 votantes), `EXTENDER` (6.0), `RESOLVER` (3.0 de negaciones y 2 votantes) o `NINGUNA`                          |
| `PoliticaDeReputacion`   | Política pura | +0.20 al autor confirmado, −0.50 al rechazado por moderación, +0.05 al voto acertado                                                      |

Los votos de usuarios silenciados se registran con peso 0 y no cuentan como votante.

## Casos de uso (Fase 5)

| Clase                               | Qué hace                                                                                                                                                          |
| :---------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConfirmarReporte`, `NegarReporte`  | Registran el voto (HU-03): 30 por usuario cada 10 minutos, reglas del SRS 3.2.2, decisión con todos los votos del reporte y `VotoEmitido` en la misma transacción |
| `RegistrarConfirmacionPorDuplicado` | Manejador de `ReporteDuplicadoDetectado.v1`: el duplicado cuenta como confirmación (HU-01). Descarta en silencio un voto que no procede                           |
| `AjustarReputacionPorDesenlace`     | Manejador de `ReporteConfirmado`, `ReporteResuelto` y `ReporteRechazado`: aplica `PoliticaDeReputacion` con el desenlace que `reports` aplicó de verdad           |

## Eventos que emite

| Evento           | Audiencia | Cuándo                                                 |
| :--------------- | :-------- | :----------------------------------------------------- |
| `VotoEmitido.v1` | Interna   | Se registra un voto. Lleva la decisión de verificación |

## Eventos que escucha

| Evento                         | Qué hace                                              |
| :----------------------------- | :---------------------------------------------------- |
| `ReporteDuplicadoDetectado.v1` | Registra una confirmación de quien envió el duplicado |
| `ReporteConfirmado.v1`         | Premia al autor y a quienes confirmaron               |
| `ReporteResuelto.v1`           | Premia a quienes negaron                              |
| `ReporteRechazado.v1`          | Penaliza al autor si el motivo es `MODERACION`        |

## Puertos

| Puerto                      | Para qué                                                                                                                   |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `RepositorioDeVotos`        | Guardar y leer los votos de un reporte                                                                                     |
| `RepositorioDeReputaciones` | Guardar y leer la reputación de un usuario                                                                                 |
| `ConsultaDeReporte`         | Conocer el autor, el estado, la ubicación y las extensiones de un reporte. Lo conecta la raíz de composición con `reports` |
| `UnidadDeTrabajoDeVoto`     | Guardar voto, reputación y eventos en una transacción, o varias reputaciones juntas                                        |
| `LimitadorDeFrecuencia`     | Límite de votos por usuario (en `shared-kernel`)                                                                           |

## Interfaz pública

`verificationModulo` en `index.ts`, junto con los casos de uso, los manejadores y los adaptadores `RepositorioVotosPg`, `RepositorioReputacionesPg` y `UnidadDeTrabajoVotoPg`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`votos` y `reputaciones`. Columnas y restricciones en `docs/diccionario-datos.md`.

`id_reporte` e `id_usuario` guardan identificadores de `reports` y de `identity` sin clave foránea.

## Interruptor

Ninguno: es un módulo imprescindible y siempre está activo.
