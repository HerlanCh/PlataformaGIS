# Matriz de marco lógico

> **Estado: propuesta para revisar.** La redactó el asistente el 2026-10-24 a partir del SRS, del roadmap y de
> lo que la plataforma ya mide, porque la matriz del documento del proyecto no estaba en el repositorio. Las metas
> son propuestas: el autor y el tutor deben aprobarlas **antes** de empezar el piloto, para no ajustarlas a los
> resultados.

Proyecto: Plataforma GIS de alerta temprana comunitaria para La Paz y El Alto. Zona del piloto: todo el rectángulo
de servicio del SRS 1.3. Duración propuesta: 4 semanas ([protocolo](piloto/protocolo.md)).

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

Los vecinos del piloto reciben información sobre incidentes más rápida y más confiable que la de un grupo de
WhatsApp vecinal, y la información falsa o vencida desaparece antes.

| ID | Indicador | Línea base (grupo de WhatsApp) | Meta | Medio de verificación |
| :-- | :-- | :-- | :-- | :-- |
| P-1 | Mediana de minutos entre que un incidente se publica en el grupo y aparece en la plataforma (incidentes de los dos lados) | Se mide en el piloto | ≤ 0 min: aparece igual o antes | `pnpm piloto:analizar`, indicador 1 |
| P-2 | Porcentaje de reportes ciertos entre los comprobados | Se mide en el piloto | Plataforma ≥ grupo | `pnpm piloto:analizar`, indicador 2 |
| P-3 | Mediana de minutos que un reporte sigue visible después de dejar de ser cierto | Se mide en el piloto | Plataforma < grupo | `pnpm piloto:analizar`, indicador 3 |

**Supuestos:** el grupo de comparación es activo (al menos un incidente por semana) y el observador puede comprobar
una muestra de reportes (ver el [protocolo](piloto/protocolo.md)).

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
| C5 | Adopción | Personas activas en un día (mediana de los días del piloto) | ≥ 10 | Métricas (`usuariosActivos`) |
| C6 | Interfaz usable | Puntaje SUS | ≥ 68 (promedio de la industria) | [Usabilidad](usabilidad/resultados.md) y encuesta de cierre |
| | | Participantes que completan las 3 tareas sin ayuda | ≥ 4 de 5 | [Planilla de usabilidad](usabilidad/planilla.md) |

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
| Piloto, comparación y análisis | 13 | Este documento, `docs/piloto/`, `docs/informe-validacion.md` |

**Recursos:** un desarrollador (el autor), planes gratuitos (Neon, Render, Vercel, GitHub, SonarCloud, UptimeRobot,
GlitchTip) y software libre (ADR-002). Costo monetario: cero.

## Cambios respecto al documento del proyecto

- **Next.js → Vite** (ADR-002): la PWA es un sitio estático; su modo sin conexión es más directo con Vite y
  vite-plugin-pwa. Pendiente desde la Fase 1.
- **Sin bot de Telegram** (ADR-004): el piloto usa solo la PWA.
- **Incidentes de fuente oficial** (ADR-006, HU-13): los publica un moderador.
