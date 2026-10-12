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
| `PoliticaDeVerificacion` | Política pura | Decide `CONFIRM` (3.0 y 2 votantes), `EXTEND` (6.0), `RESOLVE` (3.0 de negaciones y 2 votantes) o `NONE`                                  |
| `PoliticaDeReputacion`   | Política pura | +0.20 al autor confirmado, −0.50 al rechazado por moderación, +0.05 al voto acertado                                                      |

Los votos de usuarios silenciados se registran con peso 0 y no cuentan como votante.

## Eventos que emite

| Evento           | Audiencia | Cuándo                                                 |
| :--------------- | :-------- | :----------------------------------------------------- |
| `VotoEmitido.v1` | Interna   | Se registra un voto. Lleva la decisión de verificación |

## Eventos que escucha

| Evento                         | Qué hace                                                       |
| :----------------------------- | :------------------------------------------------------------- |
| `ReporteDuplicadoDetectado.v1` | Registra una confirmación de quien envió el duplicado (Fase 5) |
| `ReporteConfirmado.v1`         | Premia al autor y a quienes confirmaron (Fase 5)               |
| `ReporteResuelto.v1`           | Premia a quienes negaron (Fase 5)                              |
| `ReporteRechazado.v1`          | Penaliza al autor si el motivo es `MODERACION` (Fase 5)        |

## Puertos

| Puerto                      | Para qué                                                                                                                   |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `RepositorioDeVotos`        | Guardar y leer los votos de un reporte                                                                                     |
| `RepositorioDeReputaciones` | Guardar y leer la reputación de un usuario                                                                                 |
| `ConsultaDeReporte`         | Conocer el autor, el estado, la ubicación y las extensiones de un reporte. Lo conecta la raíz de composición con `reports` |

## Interfaz pública

`verificationModule` en `index.ts`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`votos` y `reputaciones`. Columnas y restricciones en `docs/diccionario-datos.md`.

`id_reporte` e `id_usuario` guardan identificadores de `reports` y de `identity` sin clave foránea.

## Interruptor

Ninguno: es un módulo imprescindible y siempre está activo.
