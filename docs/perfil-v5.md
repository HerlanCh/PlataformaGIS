# Perfil de grado v5: extracto para la plataforma

> **Fuente:** perfil de grado v5, *Alerta temprana de incidentes urbanos: plataforma web geoespacial con verificación
> comunitaria en La Paz y El Alto* (Taller de Graduación I, Carrera de Informática, UMSA, 2026). El documento completo
> es un Word que no se versiona (`Tesis_*.docx`, en `.gitignore`). Este extracto copia sin cambios las secciones que
> usan la plataforma, los instrumentos (ADR-007) y los documentos del piloto. Si el perfil cambia, se actualiza aquí y
> se revisa lo que lo cita.

## 3.4 Formulación del problema

**Pregunta general.** ¿En qué medida el procesamiento comunitario y geoespacial de los reportes (verificación
ponderada, deduplicación espacial y caducidad por tipo) mejora la calidad de la información sobre incidentes urbanos en
La Paz y El Alto frente a su presentación sin procesar, y a qué costo?

**Preguntas específicas.**

- **PE1.** ¿Qué reglas de verificación ponderada, deduplicación espacial, caducidad por tipo y privacidad de la ubicación
  se requieren, y cómo se implementan en una plataforma web geoespacial?
- **PE2.** ¿Cumple la plataforma los umbrales de calidad de ISO/IEC 25010 y de usabilidad fijados antes del piloto?
- **PE3.** Frente a la vista base, ¿reduce la vista procesada el tiempo para identificar los incidentes activos de una
  zona y la cantidad de ítems por incidente, y cuántas fusiones erróneas introduce?
- **PE4.** Frente a la vista base, ¿aumenta la vista procesada el porcentaje de alertas veraces y reduce el tiempo que
  un incidente terminado sigue visible, y cuántos incidentes reales deja sin confirmar o hace caducar antes de tiempo?

## 4. Objetivos

**General.** Desarrollar una plataforma web geoespacial que procese los reportes vecinales de incidentes urbanos y
evaluar, frente a su presentación sin procesar, el efecto de ese procesamiento sobre la calidad de la información en
La Paz y El Alto.

**Específicos.**

1. **OE1.** Especificar los requisitos funcionales y no funcionales y las reglas de negocio de verificación comunitaria
   ponderada, deduplicación espacial, caducidad por tipo y privacidad de la ubicación, según ISO/IEC/IEEE 29148 y la
   revisión de antecedentes.
2. **OE2.** Desarrollar una aplicación web progresiva con mapa en tiempo real, reporte sin conexión, verificación
   comunitaria ponderada, deduplicación espacial, caducidad por tipo, alertas por zona, moderación y un modo de
   evaluación con vista base, aplicando Scrum en solitario, arquitectura hexagonal y PostgreSQL con PostGIS.
3. **OE3.** Verificar que la plataforma cumpla los umbrales de calidad de producto definidos según ISO/IEC 25010,
   mediante pruebas automatizadas, de carga y de tolerancia a fallos.
4. **OE4.** Evaluar la usabilidad de la plataforma mediante una prueba basada en tareas con cinco participantes y la
   escala SUS (System Usability Scale) aplicada a todos los participantes del piloto.
5. **OE5.** Comparar, en un piloto de cuatro semanas con al menos 20 vecinos, la vista procesada frente a la vista base
   en oportunidad de localización, redundancia, veracidad y vigencia, cuantificando el costo de cada mecanismo y
   contrastando las hipótesis con pruebas no paramétricas.

## 5. Hipótesis y operacionalización de variables

La investigación tiene alcance explicativo. Compara los mismos datos del piloto en dos vistas de la misma interfaz: la
vista procesada, con los tres mecanismos activos, y la vista base, que los apaga.

- **H1 (de investigación).** En el piloto, la vista procesada ofrece información de mayor calidad sobre incidentes
  urbanos que la vista base.
- **H1a (oportunidad de localización).** El tiempo para identificar los incidentes activos de una zona es menor en la
  vista procesada, sin reducir la tasa de acierto.
- **H1b (redundancia).** La cantidad de ítems mostrados por incidente único es menor en la vista procesada.
- **H1c (veracidad).** El porcentaje de alertas que corresponden a incidentes reales es mayor entre las alertas
  confirmadas de la vista procesada que entre los reportes de la vista base.
- **H1d (vigencia).** El tiempo que un incidente terminado sigue visible como activo es menor en la vista procesada.
- **H0 (nulas, H0a a H0d).** En cada dimensión, la vista procesada no es mejor que la vista base: el tiempo de
  localización, los ítems por incidente y el tiempo de vigencia indebida no son menores, y el porcentaje de alertas
  veraces no es mayor.

**Costo de los mecanismos.** Cada hipótesis se acompaña de un indicador del error que introduce su mecanismo: fusiones
erróneas (deduplicación), incidentes reales sin confirmar y latencia de confirmación (verificación) y caducidad
prematura (caducidad). Estos indicadores se informan con su intervalo de confianza; no se contrastan como hipótesis,
pero se discuten junto a ellas para juzgar si el beneficio compensa el costo.

### 5.1 Variables

- **Independiente (VI):** modo de procesamiento, con dos niveles en la misma interfaz de mapa y con la misma zona.
  - **Vista procesada:** aplica verificación comunitaria ponderada, deduplicación espacial y caducidad por tipo.
  - **Vista base:** muestra cada reporte de las últimas 24 h como un punto propio, sin fusionarlo, sin estado de
    verificación y sin caducidad antes de las 24 h.
- **Dependiente (VD):** calidad de la información consultada, a partir del modelo de calidad de datos ISO/IEC 25012, en
  cuatro dimensiones:
  - **Oportunidad de localización** (comprensibilidad y accesibilidad): segundos que tarda el participante en
    identificar los incidentes activos de una zona, y su tasa de acierto.
  - **Redundancia** (consistencia): ítems mostrados por cada incidente único.
  - **Veracidad** (exactitud y credibilidad): porcentaje de alertas visibles que corresponden a incidentes reales.
  - **Vigencia** (actualidad): minutos que un incidente terminado sigue visible como activo.

### 5.2 Matriz de operacionalización (Tabla 3)

| Variable | Dimensión | Indicador de beneficio | Indicador de costo | Escala / instrumento |
| :-- | :-- | :-- | :-- | :-- |
| VI: modo de procesamiento | Vista | Vista procesada o vista base | — | Nominal / bitácora de sesiones |
| VD: calidad de la información | Oportunidad de localización | Mediana de segundos para identificar los incidentes activos de la zona; tasa de acierto (%) | Incidentes activos omitidos por el participante (%) | Razón / tarea cronometrada sobre instantáneas |
| | Redundancia | Ítems por incidente único (reportes del mismo evento dentro del radio de su tipo, de 50 a 200 m, cuentan como uno), con incidentes etiquetados por dos evaluadores | Fusiones erróneas: alertas que agrupan reportes de incidentes distintos (%) | Razón / registro PostGIS y planilla de etiquetado (kappa de Cohen) |
| | Veracidad | Alertas confirmadas (votos a ≤ 1 km, peso ≥ 3,0) que corresponden a incidentes reales (%), frente a todos los reportes | Incidentes reales que nunca se confirmaron (%); mediana de minutos hasta la confirmación | Razón / verificación de campo y fuentes secundarias |
| | Vigencia | Mediana de minutos que un incidente terminado sigue visible como activo | Caducidad prematura: incidentes que desaparecen cuando aún estaban activos (%) y minutos de anticipo | Razón / registro de caducidad y hora de fin verificada |

*Nota.* Los parámetros (1 km, peso 3,0, radios de 50 a 200 m y tiempos de vida por tipo) son los valores iniciales del
SRS. El análisis de sensibilidad de la sección 6.5 muestra cómo cambian los resultados con otros valores.

## 6. Marco metodológico y validación

### 6.1 Niveles metodológicos (Tabla 4)

| Nivel | Decisión | Justificación |
| :-- | :-- | :-- |
| Método general | Design Science Research (Hevner et al., 2004; Peffers et al., 2007) | Permite construir un artefacto y evaluarlo con rigor en seis actividades: identificación del problema, objetivos de la solución, diseño y desarrollo, demostración, evaluación y comunicación. |
| Enfoque | Mixto con predominio cuantitativo | Las hipótesis se contrastan con indicadores numéricos; la usabilidad y las preguntas abiertas aportan evidencia cualitativa sobre la experiencia de uso. |
| Diseño | Cuasiexperimental de medidas repetidas dentro de la plataforma | H1a compara a cada participante consigo mismo en las dos vistas, con escenarios equivalentes y orden contrabalanceado. H1b a H1d comparan cada incidente consigo mismo en las dos vistas. Es cuasiexperimental porque la muestra no es probabilística y los datos provienen del uso real, no de un entorno controlado. El diseño reduce, sin eliminar, la influencia de las diferencias entre participantes y entre datos. |
| Desarrollo de software | Scrum en solitario, con sprints semanales (Pagotto et al., 2016), alineado con ISO/IEC/IEEE 12207 | Un solo desarrollador entrega incrementos verificables a partir de un backlog derivado de las historias de usuario del SRS, con los procesos técnicos y de verificación del ciclo de vida. |

### 6.2 Población, muestra y unidades de análisis

- **Participantes:** al menos 20 vecinos mayores de 18 años de La Paz y El Alto, sin relación con el proyecto,
  reclutados por conveniencia. Se concentran en una o dos zonas para que haya vecinos cerca de cada incidente (Haklay,
  2010). Cinco de ellos hacen la prueba de usabilidad basada en tareas.
- **Unidades de análisis:** el participante (H1a), el incidente único (H1b y H1d) y la alerta o reporte verificado
  (H1c).
- **Metas mínimas de datos:** 30 incidentes únicos etiquetados (H1b), 40 reportes verificados (H1c) y 20 incidentes con
  hora de fin verificada (H1d). Si al cierre de la semana 2 no se alcanza la mitad de esas metas, el piloto se extiende
  dos semanas y se suman los incidentes de fuente oficial publicados por moderación.
- **Potencia:** con 20 pares, una prueba unilateral con α = 0,05 y potencia de 0,80 detecta un efecto estandarizado de
  alrededor de 0,6 (efecto medio a grande). Efectos menores pueden quedar sin detectar, y así se informará.

### 6.3 Procedimiento de la evaluación

- **Vista base.** Es un modo de evaluación de la misma interfaz, al que solo se accede en las sesiones de prueba, para
  que ningún vecino reciba reportes sin verificar como si fueran alertas. Se reconstruye desde el registro de eventos,
  por lo que muestra exactamente los mismos reportes que la vista procesada.
- **Tarea cronometrada (H1a).**
  - Al cierre de la semana 2 se congelan dos instantáneas del registro de eventos (escenarios E1 y E2), de momentos
    distintos, cada una con 3 a 6 incidentes activos reales y una cantidad de reportes que no difiere en más de 20 %.
  - Los incidentes activos de cada instantánea, que son la respuesta correcta, los fijan los dos evaluadores antes de
    las sesiones.
  - En las semanas 3 y 4, cada participante identifica los incidentes activos de la zona en una vista con un escenario
    y luego en la otra vista con el otro escenario, con un límite de 180 s por tarea.
  - Las cuatro secuencias posibles (vista y escenario en ambos órdenes) se asignan al azar, cinco participantes por
    secuencia.
  - Se registran el tiempo, los incidentes acertados, los omitidos y los marcados de más.
- **Etiquetado de incidentes (H1b).** El investigador y un segundo evaluador ajeno al desarrollo agrupan por separado los
  reportes de cada incidente. Su acuerdo se mide con el kappa de Cohen (Cohen, 1960) y se exige un valor mínimo de
  0,61, acuerdo sustancial (Landis y Koch, 1977). Los desacuerdos se resuelven por consenso.
- **Verificación de veracidad (H1c).** Cada semana se eligen al azar, estratificando por tipo, al menos cinco alertas
  confirmadas y cinco reportes no confirmados. Cada uno se comprueba en campo, solo si es seguro, y con fuentes
  secundarias (Tránsito, BOL-110, Mi Teleférico, la administración de la autopista, cámaras municipales y radios). Se
  informa el porcentaje que no pudo verificarse, por ejemplo en robos y jaurías.
- **Hora de fin (H1d).** Se toma de la verificación de campo o de una fuente secundaria, nunca de los votos de la propia
  plataforma, para que la referencia sea independiente del mecanismo evaluado.

### 6.4 Técnicas e instrumentos (Tabla 5)

| Técnica | Instrumento | Se aplica a | Objetivo |
| :-- | :-- | :-- | :-- |
| Pruebas de software | Vitest, Testcontainers, Playwright y k6 | Plataforma | OE3 |
| Prueba de usabilidad | Guión de tres tareas (reportar, confirmar, suscribirse a una zona) y cuestionario SUS (Brooke, 1996) en su versión validada en español (Sevilla-Gonzalez et al., 2020) | 5 participantes (tareas); todos (SUS) | OE4 |
| Tarea cronometrada pareada | Instantáneas E1 y E2, planilla de secuencias y planilla de resultados | Todos los participantes | OE5 |
| Verificación de campo y triangulación | Planilla de verificación (presencial y fuentes secundarias) | Muestra estratificada de alertas y reportes | OE5 |
| Registro automático | Métricas anonimizadas en CSV, reconstrucción de la vista base y planilla de etiquetado por dos evaluadores | Reportes, fusiones, votos y caducidad | OE5 |

### 6.5 Plan de análisis estadístico (Tabla 6)

Todas las pruebas son unilaterales, con α = 0,05 y corrección de Holm (1979) sobre las cuatro hipótesis. El análisis se
hace en R y su código se publica con los datos anonimizados.

| Hipótesis | Unidad | Comparación | Prueba | Tamaño de efecto | Costo informado |
| :-- | :-- | :-- | :-- | :-- | :-- |
| H1a | Participante (n ≥ 20) | Segundos en vista procesada frente a vista base | Rangos con signo de Wilcoxon (1945) | r = Z / √n | Tasa de acierto y omisiones en ambas vistas |
| H1b | Incidente único (n ≥ 30) | Ítems por incidente en cada vista | Rangos con signo de Wilcoxon | Delta de Cliff | Fusiones erróneas (%) con intervalo de Wilson |
| H1c | Reporte verificado (n ≥ 40) | Proporción de reales entre confirmados y no confirmados | Exacta de Fisher | Razón de odds y diferencia de proporciones con intervalo de confianza | Exhaustividad (reales confirmados / reales) y mediana de minutos hasta la confirmación |
| H1d | Incidente con hora de fin (n ≥ 20) | Minutos visibles tras el fin en cada vista | Rangos con signo de Wilcoxon | Delta de Cliff | Caducidad prematura (%) y minutos de anticipo |

Para H1c, la veracidad de la vista base se estima ponderando cada estrato por su tamaño en el total de reportes. En la
vista base, el tiempo visible tras el fin es la creación del último reporte del incidente más 24 h, menos la hora de
fin. En la vista procesada es la caducidad o la resolución, menos la hora de fin. Como la ventaja de la vista procesada
en H1b y H1d es en parte esperable por diseño, la discusión se centra en su magnitud y en su costo.

**Análisis de sensibilidad (exploratorio).** Como el registro de eventos se conserva, el piloto se reprocesa con otros
parámetros: umbral de confirmación de 2,0, 3,0 y 4,0; radios de deduplicación de 0,5, 1 y 1,5 veces el valor del SRS; y
tiempos de vida de 0,5, 1 y 1,5 veces el valor del SRS. Se informa cómo cambian la veracidad, la exhaustividad, las
fusiones erróneas y la caducidad prematura, para recomendar parámetros. No se contrasta como hipótesis.

### 6.6 Viabilidad y ética

- **Viabilidad:** un desarrollador, software libre y planes gratuitos; costo directo cercano a cero.
- **Consentimiento y anonimato:** cada participante recibe el consentimiento informado y puede retirarse cuando quiera.
  La plataforma no pide nombre: cada sesión se vincula a un código anónimo derivado del dispositivo, un hash no
  reversible.
- **Privacidad:** la plataforma nunca muestra el autor de un reporte. En robos muestra solo el centro de la celda de
  200 m que contiene la ubicación; en los demás tipos, el punto del incidente. No se publican fotos ni descripciones de
  personas.
- **Emergencias:** la plataforma no sustituye a las líneas oficiales de emergencia (BOL-110, 118 y 119) y lo dice en su
  interfaz.
- **Datos:** sin identificadores personales y conservados solo durante el estudio; los datos abiertos se publican
  agregados.
- **Seguridad del investigador:** la verificación presencial solo se hace donde es seguro; no se acude a bloqueos
  activos ni a robos recientes.

## 8.2 Límites

**Fuera del alcance:** rutas alternas, despacho de emergencias, integración con sistemas de la Policía o de Tránsito,
aplicación nativa y fotos en los reportes.

**Restricciones que condicionan el estudio:**

- La muestra no es probabilística: los resultados no se generalizan a toda la población.
- La comparación es interna. La vista base reproduce la ausencia de los mecanismos, no el funcionamiento real de los
  grupos de mensajería ni de las redes sociales. Por eso el estudio no permite afirmar nada sobre esos canales ni sobre
  la superioridad frente a otras aplicaciones.
- Parte de la ventaja de la vista procesada en redundancia y vigencia es esperable por diseño; el aporte del estudio
  está en medir su magnitud y su costo.
- Con 20 participantes solo se detectan efectos medios o grandes en la tarea cronometrada.
- Cuatro semanas pueden inflar el uso por efecto novedad, y un piloto con pocos incidentes puede no alcanzar las metas
  mínimas de datos (mitigado con la extensión prevista en la sección 6.2).
- La verificación depende de la densidad de vecinos por zona. La identidad por dispositivo y la ubicación pueden
  manipularse; se mitigan con límites de tasa, moderación y pruebas de abuso.
- Robos y jaurías son difíciles de verificar, lo que reduce la muestra útil de H1c para esos tipos.
- La precisión del GPS baja en quebradas y calles estrechas.
- Los planes gratuitos limitan la capacidad de cómputo y pueden cambiar sus condiciones.
- En iOS, las alertas solo llegan con la aplicación instalada (iOS 16.4 o superior).
- No se promete un impacto en la seguridad de la ciudad ni la adopción de la plataforma por instituciones.

## Anexo A. Matriz de consistencia

### Tabla A1. Correspondencia entre causas, mecanismos, hipótesis y efectos

| Causa | Mecanismo | Dimensión e hipótesis | Efecto que atiende | Costo que se mide |
| :-- | :-- | :-- | :-- | :-- |
| Avisos dispersos, sin mapa ni filtro por zona | Los tres mecanismos, sobre el mapa por zona | Oportunidad de localización (H1a) | Pérdida de tiempo para saber qué pasa en la zona | Incidentes activos omitidos |
| Avisos repetidos que no se consolidan | Deduplicación espacial | Redundancia (H1b) | Saturación de mensajes repetidos | Fusiones erróneas |
| Nadie verifica ni pondera la reputación de quien avisa | Verificación comunitaria ponderada | Veracidad (H1c) | Alarma y desconfianza por rumores falsos | Incidentes reales sin confirmar; latencia de confirmación |
| Los avisos no caducan cuando el incidente termina | Caducidad por tipo | Vigencia (H1d) | Desvíos y decisiones por incidentes ya terminados | Caducidad prematura |

### Tabla A2. Correspondencia entre preguntas, objetivos, hipótesis e instrumentos

| Pregunta | Objetivo | Hipótesis o umbral | Instrumento |
| :-- | :-- | :-- | :-- |
| PE1 | OE1 y OE2 | Reglas especificadas e implementadas | SRS y código de la plataforma |
| PE2 | OE3 y OE4 | Umbrales de la Tabla 7 | Pruebas de software, prueba de tareas y SUS |
| PE3 | OE5 | H1a y H1b | Tarea cronometrada, registro PostGIS y planilla de etiquetado |
| PE4 | OE5 | H1c y H1d | Planilla de verificación y registro de caducidad |

*La Tabla 7 (umbrales ISO/IEC 25010) coincide con los RNF de [`calidad.md`](calidad.md) y su verificación en
[`informe-calidad.md`](informe-calidad.md).*
