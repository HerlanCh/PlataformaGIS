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

| Clase                         | Qué hace                                                                                                     |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `RegistrarEventoDeEvaluacion` | Manejador de los eventos del reporte y de los votos: registra cada envío, transición y voto una sola vez     |
| `ConsultarEstadoDelRegistro`  | Envíos registrados y hora del último (rol `MODERADOR`). La prueba de humo lo usa                             |
| `ConsultarVistas`             | Reconstruye la vista procesada y la base de una zona en un instante no futuro (`reconstruirVistas`)          |
| `CongelarInstantanea`         | Guarda ambas vistas de una zona en un instante como una instantánea inmutable, con nombre único              |
| `ListarInstantaneas`          | Las instantáneas, con cuántos puntos tiene cada vista                                                        |
| `ObtenerInstantanea`          | Una instantánea con sus puntos, tal como se congeló                                                          |
| `FijarClave`                  | Fija la clave de una instantánea (incidentes activos) antes de las sesiones; no cambia tras la primera tarea |
| `CrearSesion`                 | Abre la sesión de un participante (código anónimo `P07`) con su secuencia, sobre E1 y E2                     |
| `ListarSesiones`              | Sesiones con el avance y las marcas de cada tarea                                                            |
| `IniciarTarea`                | Fija la hora de inicio y entrega los puntos de la vista, sin decir cuál es                                   |
| `TerminarTarea`               | Cierra la tarea con el tiempo del servidor (máximo 180 s) y una marca por punto de la vista                  |
| `ListarEnviosParaEtiquetar`   | Envíos de la comunidad del periodo, sin el reporte de la plataforma ni las etiquetas del otro evaluador      |
| `GuardarEtiquetas`            | Guarda o corrige el grupo de cada envío de un evaluador (A, B o consenso)                                    |
| `MedirAcuerdo`                | Kappa de Cohen entre A y B sobre los pares candidatos, con los desacuerdos para el consenso                  |
| `SortearReportes`             | Por categoría, 5 alertas confirmadas y 5 reportes no confirmados del periodo, al azar                        |
| `RegistrarVerificacion`       | Resultado (real, falso, no verificable), hora de fin y fuente de un reporte                                  |
| `ListarVerificaciones`        | Verificaciones registradas                                                                                   |
| `ExportarEvaluacion`          | Un CSV por tabla con las columnas de `COLUMNAS_EXPORTADAS`, para `pnpm piloto:analizar` y la sensibilidad    |

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
raíz de composición (`apps/*`), que expone `/v1/evaluacion/estado`, `/v1/evaluacion/vistas` y
`/v1/evaluacion/instantaneas`, `/v1/evaluacion/sesiones`, `/v1/evaluacion/tareas/:id/{inicio,fin}`,
`/v1/evaluacion/etiquetado`, `/v1/evaluacion/acuerdo`, `/v1/evaluacion/verificacion/sorteo` y
`/v1/evaluacion/verificaciones` (todas con rol `MODERADOR`). La web las usa desde `/evaluacion`.

## Tablas propias

`evaluacion_envios`, `evaluacion_transiciones`, `evaluacion_votos`, `evaluacion_instantaneas` y
`evaluacion_puntos_instantanea` (inmutables por un disparador), `evaluacion_sesiones`, `evaluacion_tareas`,
`evaluacion_marcas`, `evaluacion_etiquetas`, `evaluacion_verificaciones` y `evaluacion_claves`. Detalle en
[`docs/diccionario-datos.md`](../../../docs/diccionario-datos.md).

## Las dos vistas

- **Procesada:** los reportes `ACTIVO` o `CONFIRMADO` con `caducaEn ≥ t`, como la consulta del mapa.
- **Base:** cada envío de la comunidad recibido en `(t − 24 h, t]`, como un punto propio.
- **Iguales en ambas:** fuera lo rechazado por moderación desde el rechazo, con sus duplicados; los incidentes
  oficiales vigentes aparecen en las dos.

## Herramientas

- **Tarea cronometrada:** el participante toca cada incidente vigente distinto que ve; tocarlo otra vez lo
  desmarca. La respuesta correcta es la clave que fijan los evaluadores (sin la clave de E1 y E2 no hay sesiones), y
  la secuencia se sortea entre las que llevan menos sesiones (perfil v5, 6.3). Secuencias: 1 Base·E1 → Procesada·E2, 2 Procesada·E1 → Base·E2, 3 Base·E2 → Procesada·E1,
  4 Procesada·E2 → Base·E1. Aciertos, omisiones y marcados de más se calculan en el análisis.
- **Etiquetado:** pares candidatos de la misma categoría, a ≤ 24 h y a ≤ 3 veces el radio de deduplicación del SRS
  (lo inyecta la raíz de composición desde `reports`). Kappa mínimo del protocolo: 0,61.
- **Verificación:** referencia independiente; nunca usa los votos de la plataforma.

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
