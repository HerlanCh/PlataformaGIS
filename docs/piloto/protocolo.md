# Protocolo del piloto

Fase 13 (ISO/IEC 12207, validación). Objetivo: contrastar las hipótesis H1a a H1d del [perfil de grado v5](../perfil-v5.md)
comparando, sobre los mismos datos del piloto, la vista procesada con la vista base (ADR-007), y medir los indicadores
de la [matriz de marco lógico](../marco-logico.md).

## Alcance

- **Zona:** una o dos zonas de La Paz o El Alto, dentro del rectángulo del SRS 1.3, para que haya vecinos cerca de cada
  incidente (perfil, 6.2). Se eligen antes del ensayo general y no cambian a mitad del piloto.
- **Duración:** 4 semanas seguidas, más 2 si al cierre de la semana 2 no se alcanza la mitad de las metas mínimas de
  datos (ver [Calendario](#calendario)).
- **Entorno:** producción, `https://plataforma-gis-produccion.vercel.app`, con `FEATURE_EVALUATION` y `FEATURE_METRICS`
  activos. Staging no se usa con participantes.
- **Participantes:** al menos 20 vecinos mayores de 18 años, sin relación con el proyecto, reclutados por conveniencia
  en las zonas elegidas. Cinco de ellos hacen además la prueba de usabilidad.
- **Metas mínimas de datos** (perfil, 6.2): 30 incidentes únicos etiquetados (H1b), 40 reportes verificados (H1c) y 20
  incidentes con hora de fin verificada (H1d).

## Roles

| Rol | Quién | Qué hace |
| :-- | :-- | :-- |
| Investigador | Autor del proyecto, con rol `MODERADOR` | Incorpora a los participantes, hace las sesiones de usabilidad y de la tarea cronometrada en su dispositivo, congela E1 y E2, verifica y redacta el informe. Es el evaluador A |
| Segundo evaluador | Persona ajena al desarrollo, con rol `MODERADOR` solo durante el piloto | Etiqueta por separado los envíos (evaluador B), fija con el investigador la clave de E1 y E2 y resuelve los desacuerdos por consenso. No modera ni publica |
| Moderador | Investigador | Revisa la cola y publica los incidentes oficiales (HU-13) |

El rol del segundo evaluador se da con `pnpm moderador:ascender` (o el workflow `Administracion`) al empezar y se
retira al cerrar. Los participantes nunca ven `/evaluacion` ni la vista base fuera de una sesión (perfil, 6.3).

## Calendario

| Semana | Actividades |
| :-- | :-- |
| −1 (ensayo general) | Una semana en producción con 3 o 4 personas, incluido un iPhone con la PWA instalada. Activar `FEATURE_EVALUATION` y `FEATURE_METRICS` desde el primer día y comprobar con la prueba de humo que el registro anota los envíos. Recorrer todos los instrumentos de `/evaluacion` (congelar, clave, tarea, etiquetado, verificación) y exportar con `pnpm piloto:exportar`. Elegir las zonas. Ascender al segundo evaluador |
| 1 | Incorporar a los participantes con la [guía de instalación](guia-instalacion.md). Hacer las 5 sesiones de usabilidad ([guion](../usabilidad/guion.md)) y corregir los bloqueos |
| 1 y 2 | Moderar y publicar incidentes oficiales a diario. Verificar cada semana (ver [Verificación](#verificación)). Los dos evaluadores etiquetan los envíos por separado |
| Cierre de la 2 | Revisar las metas mínimas de datos. **Si no se alcanza la mitad**, extender el piloto dos semanas y sumar los incidentes de fuente oficial publicados por moderación (perfil, 6.2); las semanas 3 y 4 se corren dos semanas. Congelar E1 y E2 (ver [Tarea cronometrada](#tarea-cronometrada)) |
| 3 y 4 | Sesiones de la tarea cronometrada con todos los participantes. Seguir verificando y etiquetando. Medir el acuerdo (kappa ≥ 0,61) y resolver los desacuerdos por consenso |
| Cierre | Aplicar el SUS a todos y la [encuesta de impacto](encuesta-impacto.md). Exportar y correr el análisis ([README](README.md#análisis-al-cierre)) |
| Después | Exportar el conjunto etiquetado del clasificador y evaluarlo (Fase 10, paso 3). Redactar el [informe de validación](../informe-validacion.md) |

## Rutina diaria del moderador

1. **Fuentes oficiales, dos veces al día** (alrededor de las 7:30 y de las 17:30): revisar las cuentas públicas de
   Tránsito, de la ABC (transitabilidad) y de Mi Teleférico. Por cada corte o desvío vigente en las zonas:
   1. ubicarlo en el mapa de la app;
   2. abrir `/moderacion` → *Publicar incidente oficial*;
   3. elegir categoría y fuente, y publicar.
2. **Cola de moderación**, al menos una vez al día: rechazar lo falso o lo que identifica a una persona; mantener lo
   demás.
3. No publicar como oficial nada que no venga de una fuente oficial.

## Verificación

Cada semana, en `/evaluacion` → Verificar, se sortean al azar y por tipo al menos cinco alertas confirmadas y cinco
reportes no confirmados (perfil, 6.3). Cada uno se comprueba:

- **En campo, solo si es seguro.** Nunca se acude a bloqueos activos ni a robos recientes (perfil, 6.6).
- **Con fuentes secundarias:** Tránsito, BOL-110, Mi Teleférico, la administración de la autopista, cámaras
  municipales y radios.

Se registra si fue real, falso o no verificable, la **hora de fin** (solo si fue real y se conoce) y la fuente. La hora
de fin sale de la verificación, **nunca** de los votos de la plataforma. El detalle de la fuente es breve y no
describe a personas. Lo anotado en papel se transcribe a la
[planilla de verificación](plantilla-verificacion.csv).

## Tarea cronometrada

1. **Congelar E1 y E2** al cierre de la semana 2, en `/evaluacion` → Congelar: dos momentos distintos de la misma
   zona, cada uno con 3 a 6 incidentes activos reales y una cantidad de reportes que no difiera en más de 20 %. La
   pantalla avisa si no se cumple.
2. **Fijar la clave** de cada instantánea: los dos evaluadores eligen juntos los incidentes activos (la respuesta
   correcta). Sin la clave de E1 y E2 no se pueden abrir sesiones, y la clave no cambia después de la primera tarea.
3. **Sesiones** (semanas 3 y 4), en el dispositivo del investigador. Abrir la sesión con el código anónimo del
   participante (`P01`, `P02`…) y la secuencia **al azar** (la app la sortea entre las que llevan menos sesiones: cinco
   por secuencia). Leer la consigna:

   > «Toca cada incidente vigente distinto que veas en el mapa. Si un mismo incidente aparece varias veces, márcalo una
   > sola vez. Tienes 3 minutos.»

   El participante hace la tarea 1 y luego la 2. No se le dice qué vista ve. El tiempo y las marcas los registra la
   app.

## Etiquetado

El investigador (A) y el segundo evaluador (B) agrupan por separado los envíos de cada incidente en `/evaluacion` →
Etiquetar: el mismo número de grupo para los envíos del mismo incidente real. Ninguno ve las etiquetas del otro ni el
reporte al que la plataforma asignó cada envío. Cada semana se mide el acuerdo (*Medir acuerdo entre A y B*); al
cierre se exige kappa ≥ 0,61 y los desacuerdos se resuelven por consenso (evaluador «Consenso»).

## Exportaciones

- Cada semana: `pnpm piloto:metricas <inicio> <hoy> docs/piloto/datos/metricas-semana-N.csv` y, al cierre,
  `pnpm piloto:exportar docs/piloto/datos`, con `DATABASE_URL` de producción en una terminal local. **No** se pega esa
  cadena en el chat ni en el repositorio: se lee del gestor de contraseñas.
- UptimeRobot: al cierre, anotar el porcentaje de disponibilidad del periodo (RNF-05).

## Consentimiento informado

Antes de incorporar a una persona, léele esto o dáselo por escrito:

> «Te invito a probar durante 4 semanas (quizá 6) una aplicación para avisar de incidentes en La Paz y El Alto. Es
> parte de un proyecto de grado. La app no te pide nombre, teléfono ni correo: solo identifica tu teléfono con un código
> anónimo. La ubicación exacta de lo que reportes no se muestra a nadie. No reportes fotos ni descripciones de personas.
> La app **no reemplaza** a las líneas de emergencia (110 Policía, 118 Ambulancia, 119 Bomberos). En la tercera o
> cuarta semana te pediré una tarea corta de 3 minutos en mi teléfono, y al final una encuesta corta y anónima. Puedes
> dejarlo cuando quieras, sin dar explicaciones.»

Se registra solo cuántas personas aceptaron, no quiénes.

## Privacidad y ética

- **Ningún dato personal en las planillas ni en el repositorio:** sin nombres, números de teléfono, fotos ni
  descripciones de personas. Los participantes de la tarea se identifican solo con su código (`P07`).
- Los datos de la plataforma ya son anónimos: el registro de la evaluación y las métricas no guardan autor, votantes ni
  ubicación real.
- Las encuestas son anónimas: se numeran, no se nombran.
- Si alguien pide salir, se dejan de usar sus respuestas a la encuesta y su tarea; lo que reportó ya es anónimo y no se
  puede separar.
- Los datos se conservan solo durante el estudio; los datos abiertos se publican agregados (perfil, 6.6).

## Si algo sale mal

| Problema | Qué hacer |
| :-- | :-- |
| La app no carga o UptimeRobot avisa | Seguir el [runbook](../runbook.md). Anotar el corte en el informe |
| Un reporte expone a una persona | Rechazarlo desde la cola de inmediato |
| Al cierre de la semana 2 no se llega a la mitad de las metas | Extender dos semanas y sumar los incidentes oficiales (perfil, 6.2); anotarlo en el informe |
| E1 o E2 no cumplen los criterios (3 a 6 incidentes, ≤ 20 % de diferencia) | Congelar otro instante antes de la primera sesión; después ya no se cambia |
| El kappa no llega a 0,61 | Revisar juntos los desacuerdos, aclarar el criterio de «mismo incidente» y volver a etiquetar los pares en desacuerdo |
| Pocos participantes activos | Insistir en la semana 2 con un recordatorio. No regalar nada a cambio de reportes: sesgaría los datos |
