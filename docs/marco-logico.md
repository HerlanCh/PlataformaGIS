# Matriz de marco lógico

> **Estado: aprobada por el autor (2026-11-26).** El proyecto no tiene tutor asignado. La redactó el asistente el
> 2026-10-24 y se alineó al [perfil de grado v5](perfil-v5.md) el 2026-11-26 (ADR-007): el Propósito es la hipótesis H1
> con H1a a H1d. El perfil trae una matriz de consistencia (Anexo A), no un marco lógico; esta matriz la complementa con
> los componentes y las actividades. Las metas se fijan **antes** del piloto, para no ajustarlas a los resultados.

Proyecto: Plataforma GIS de alerta temprana comunitaria para La Paz y El Alto. Piloto de cuatro semanas, en una o dos
zonas, con al menos 20 vecinos ([protocolo](piloto/protocolo.md)).

Cada indicador indica con qué instrumento se mide. Los valores medidos van en el
[informe de validación](informe-validacion.md).

## Fin

Contribuir a que los vecinos de La Paz y El Alto se expongan menos a incidentes urbanos (bloqueos, accidentes,
robos, daños en la vía y jaurías) gracias a información oportuna y verificada por la comunidad.

| ID | Indicador | Línea base | Meta | Medio de verificación |
| :-- | :-- | :-- | :-- | :-- |
| F-1 | Participantes que evitaron al menos un incidente o cambiaron su ruta gracias a la plataforma | No existe | ≥ 60 % | [Encuesta de impacto](piloto/encuesta-impacto.md), pregunta 1 |
| F-2 | Participantes que se sienten mejor informados sobre los incidentes de su zona que antes del piloto | No existe | ≥ 70 % de acuerdo o muy de acuerdo | Encuesta de impacto, pregunta 2 |

**Supuestos:** durante el piloto ocurren incidentes en las zonas de los participantes, y la situación del país no
cambia tanto que distorsione la comparación (por ejemplo, un paro general de varias semanas).

## Propósito

En el piloto, la vista procesada (verificación ponderada, deduplicación espacial y caducidad por tipo) ofrece
información de mayor calidad sobre incidentes urbanos que la vista base, que muestra los mismos reportes sin procesar
(H1, [perfil v5](perfil-v5.md) sección 5). La comparación es interna: no permite afirmar nada sobre los grupos de
mensajería ni sobre otras aplicaciones (perfil, 8.2).

**Meta de cada hipótesis:** rechazar su H0 con la prueba unilateral de la Tabla 6 del perfil, α = 0,05 con corrección de
Holm sobre las cuatro, y con al menos la muestra mínima. Los indicadores de costo **no tienen meta**: se informan con su
intervalo de confianza del 95 % y se discuten junto a cada hipótesis (perfil, 5).

| ID | Hipótesis | Indicador de beneficio | Indicador de costo | Unidad (n mínima) | Medio de verificación |
| :-- | :-- | :-- | :-- | :-- | :-- |
| P-1 | H1a: oportunidad de localización | Mediana de segundos para identificar los incidentes activos de la zona, menor en la vista procesada, sin reducir la tasa de acierto | Incidentes activos omitidos (%) | Participante (20) | Tarea cronometrada en `/evaluacion`; `pnpm piloto:analizar` y `contraste.R` (Wilcoxon, r) |
| P-2 | H1b: redundancia | Ítems por incidente único, menos en la vista procesada | Fusiones erróneas (%) | Incidente único etiquetado (30) | Registro de la evaluación y etiquetado con kappa ≥ 0,61; Wilcoxon y delta de Cliff |
| P-3 | H1c: veracidad | Alertas confirmadas que corresponden a incidentes reales (%), mayor que en la vista base (ponderada por estrato) | Reales sin confirmar (%), minutos hasta la confirmación y no verificables (%) | Reporte verificado (40) | Verificación de campo y fuentes secundarias; Fisher, razón de odds y diferencia de proporciones |
| P-4 | H1d: vigencia | Minutos que un incidente terminado sigue visible, menos en la vista procesada | Caducidad prematura (%) y minutos de anticipo | Incidente con hora de fin verificada (20) | Registro de la evaluación y hora de fin verificada; Wilcoxon y delta de Cliff |

**Supuestos:** el piloto alcanza las metas mínimas de datos o, si al cierre de la semana 2 no llega a la mitad, se
extiende dos semanas (perfil, 6.2); hay vecinos cerca de los incidentes en la zona elegida; los dos evaluadores llegan a
un acuerdo sustancial (kappa ≥ 0,61) y la verificación de campo es segura.

**Sensibilidad (exploratoria):** el registro se reprocesa con umbrales de 2,0, 3,0 y 4,0 y con radios y tiempos de vida
de 0,5, 1 y 1,5 veces los del SRS (`pnpm piloto:sensibilidad`). No se contrasta como hipótesis: sirve para recomendar
parámetros.

## Componentes

| ID | Componente | Indicador | Meta | Medio de verificación |
| :-- | :-- | :-- | :-- | :-- |
| C1 | Plataforma en producción, disponible y segura | Tiempo en línea durante el piloto (RNF-05) | ≥ 95 % | UptimeRobot |
| | | Respuestas 5xx (RNF-08) | < 1 % | GlitchTip y logs de Render |
| | | Respuestas públicas con ubicación real o autor (RNF-14) | 0 | Prueba de privacidad de la CI |
| C2 | Reporte y verificación comunitaria | Reportes comunitarios que llegan a `CONFIRMADO` | ≥ 30 % | `GET /v1/moderacion/metricas` |
| | | Mediana de minutos hasta la primera confirmación | ≤ 30 min | Métricas |
| C3 | Caducidad y cierre por la comunidad | Reportes cerrados por moderación | ≤ 10 % de los cerrados | Métricas |
| C4 | Mapa precargado con fuentes oficiales | Incidentes oficiales publicados por semana (HU-13) | ≥ 5 | Métricas (`oficiales`) |
| C5 | Adopción | Participantes incorporados al piloto (perfil, 6.2) | ≥ 20 | Registro del investigador (solo el conteo) |
| | | Personas activas en un día (mediana de los días del piloto) | ≥ 10 | Métricas (`usuariosActivos`) |
| C6 | Interfaz usable | Puntaje SUS | ≥ 68 (promedio de la industria) | [Usabilidad](usabilidad/resultados.md) y encuesta de cierre |
| | | Participantes que completan las 3 tareas sin ayuda | ≥ 4 de 5 | [Planilla de usabilidad](usabilidad/planilla.md) |
| C7 | Instrumentos de evaluación (ADR-007) | Instrumentos probados en el ensayo general (vista base, instantáneas, tarea, etiquetado y verificación) | Todos | Ensayo general, `/evaluacion` |
| | | Acuerdo del etiquetado entre los dos evaluadores | kappa ≥ 0,61 | `/evaluacion` → Etiquetar → Medir acuerdo |

**Supuestos:** los planes gratuitos mantienen sus condiciones (RSK-01 y RSK-02), y los participantes tienen un
teléfono con navegador moderno y datos móviles.

## Actividades

| Actividad | Fases del roadmap | Medio de verificación |
| :-- | :-- | :-- |
| Requisitos, riesgos y metas de calidad | 0 | `docs/srs.md`, `docs/riesgos.md`, `docs/calidad.md` |
| Arquitectura, dominio, persistencia, consultas espaciales y casos de uso | 1 a 5 | CI: dependency-cruiser, cobertura, `docs/rendimiento/` |
| API, tiempo real y PWA | 6 a 8 | Contrato OpenAPI, pruebas e2e |
| Moderación, datos abiertos y clasificador | 10 | `docs/trazabilidad.md` |
| Verificación integral y transición a producción | 11 y 12 | `docs/informe-calidad.md`, `docs/runbook.md` |
| Instrumentos de evaluación, piloto, comparación interna y análisis | 13 | Este documento, `docs/piloto/`, `tools/piloto/contraste.R`, `docs/informe-validacion.md` |

**Recursos:** un desarrollador (el autor), planes gratuitos (Neon, Render, Vercel, GitHub, SonarCloud, UptimeRobot,
GlitchTip) y software libre (ADR-002). Costo monetario: cero.

## Cambios respecto al documento del proyecto

- **Next.js → Vite** (ADR-002): la PWA es un sitio estático; su modo sin conexión es más directo con Vite y
  vite-plugin-pwa. Pendiente desde la Fase 1.
- **Sin bot de Telegram** (ADR-004): el piloto usa solo la PWA.
- **Incidentes de fuente oficial** (ADR-006, HU-13): los publica un moderador.
- **Comparación interna** (ADR-007, perfil v5): la vista procesada frente a la vista base de los mismos datos, en vez de
  un grupo de WhatsApp. Los indicadores P-1 a P-3 del grupo se reemplazaron por H1a a H1d.
