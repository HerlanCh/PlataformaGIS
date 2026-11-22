# Módulo `evaluation`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Instrumentos de evaluación del piloto (Fase 13, [ADR-007](../../../docs/adr/ADR-007.md), HU-14). Compara los mismos
datos en dos vistas de la misma interfaz: la **procesada** (lo que mostró el mapa) y la **base** (cada envío de las
últimas 24 h como un punto propio, sin fusionar, sin estado y sin caducidad).

Para eso lleva un registro propio, alimentado solo por eventos:

- cada envío: un reporte creado o un duplicado que `reports` absorbió, con su categoría, su `publicLocation`, su fuente
  oficial y su hora;
- cada cambio de estado de un reporte, con su hora y la caducidad que deja;
- cada voto, con su peso, su valor y la decisión que produjo.

No guarda el autor, el votante, quien envió un duplicado ni la ubicación real. No lee `reportes`: no extiende la
excepción del ADR-003. Solo registra lo que ocurre desde que se activa.

## Casos de uso

| Clase                         | Qué hace                                                                                                 |
| :---------------------------- | :------------------------------------------------------------------------------------------------------- |
| `RegistrarEventoDeEvaluacion` | Manejador de los eventos del reporte y de los votos: registra cada envío, transición y voto una sola vez |
| `ConsultarEstadoDelRegistro`  | Envíos registrados y hora del último (rol `MODERADOR`). La prueba de humo lo usa                         |

## Eventos que emite

_Ninguno._

## Eventos que escucha

| Evento                                                            | Qué hace                                                 |
| :---------------------------------------------------------------- | :------------------------------------------------------- |
| `ReporteCreado.v1` y `.v2`                                        | Envío `CREADO` y primera transición (`ACTIVO`)           |
| `EnvioDuplicadoRegistrado.v1`                                     | Envío `DUPLICADO`, que apunta al reporte que lo absorbió |
| `ReporteConfirmado.v1`, `ReporteExtendido.v1`                     | Transición a `CONFIRMADO` con su nueva caducidad         |
| `ReporteResuelto.v1`, `ReporteCaducado.v1`, `ReporteRechazado.v1` | Transición a un estado final                             |
| `VotoEmitido.v1`                                                  | Peso, valor y decisión del voto, sin `idVotante`         |

## Interfaz pública

`evaluationModulo`, los casos de uso y `RepositorioEvaluacionPg` en `index.ts`. Ningún otro módulo la importa: solo la
raíz de composición (`apps/*`), que expone `GET /v1/evaluacion/estado`.

## Tablas propias

`evaluacion_envios`, `evaluacion_transiciones` y `evaluacion_votos`. Detalle en
[`docs/diccionario-datos.md`](../../../docs/diccionario-datos.md).

## Privacidad

- Ninguna tabla tiene columna para el autor, el votante ni la ubicación real; una prueba de integración lo comprueba
  sobre `information_schema`.
- En las categorías sensibles, la ubicación de un duplicado es el centro de su celda de 200 m, como la del mapa.
- Los reportes del usuario de humo sí se registran: se rechazan enseguida y quedan fuera de ambas vistas, y así la
  prueba de humo comprueba que el módulo registra.

## Interruptor

`FEATURE_EVALUATION`. Se activa en el ensayo general, al menos una semana antes del piloto.

## Eliminar el módulo

Borra esta carpeta y ejecuta `node tools/modules/sync-modules.mjs && pnpm install`. `reports` seguiría emitiendo
`EnvioDuplicadoRegistrado.v1`, que nadie escucharía.
