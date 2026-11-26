# Piloto (Fase 13)

| Documento | Para qué |
| :-- | :-- |
| [`protocolo.md`](protocolo.md) | Alcance, roles, calendario, consentimiento y privacidad |
| [`guia-instalacion.md`](guia-instalacion.md) | Para los participantes: instalar la PWA y activar avisos |
| [`encuesta-impacto.md`](encuesta-impacto.md) | Encuesta de cierre: indicadores del Fin (F-1 y F-2) |
| [`plantilla-verificacion.csv`](plantilla-verificacion.csv) | Verificaciones de campo anotadas fuera de la app, en el formato de la exportación |
| `datos/` | Exportación del piloto (se crea al exportar). Sin datos personales |
| `analisis/` | Salida de `pnpm piloto:analizar` y de `contraste.R` |

La comparación es interna: la vista procesada frente a la vista base de los mismos datos (ADR-007). El grupo de
WhatsApp se retiró. Los instrumentos (instantáneas, tarea cronometrada, etiquetado y verificación) están en
`/evaluacion`, con el rol `MODERADOR`. La usabilidad usa los instrumentos de la Fase 11:
[`../usabilidad/`](../usabilidad/guion.md).

## Fechas

Todas las horas van en **ISO 8601 con zona horaria**: `2026-11-03T08:15-04:00` (hora de Bolivia) o en UTC. El análisis
rechaza formatos como `3/11/2026 8:15`, que son ambiguos.

## Verificación anotada a mano

Lo normal es registrar cada verificación en `/evaluacion` → Verificar. Si en campo se anotó en papel, se transcribe a
[`plantilla-verificacion.csv`](plantilla-verificacion.csv) y se agregan sus filas al `verificaciones.csv` de la
exportación antes de analizar:

| Columna | Contenido |
| :-- | :-- |
| `id_reporte` | Id del reporte (el de la plataforma) |
| `resultado` | `REAL`, `FALSO` o `NO_VERIFICABLE` |
| `fin_en` | Cuándo dejó de ser cierto. Solo si fue `REAL`; vacío si no se sabe |
| `fuente` | `CAMPO` o `SECUNDARIA` |
| `detalle_fuente` | Breve, **sin nombres, teléfonos ni descripciones de personas** |
| `registrada_en` | Cuándo se registró |

## Análisis al cierre

```sh
# 1. Exportar (DATABASE_URL de producción en la terminal, nunca en el repositorio)
pnpm piloto:exportar docs/piloto/datos

# 2. Indicadores de beneficio y de costo (H1a a H1d) y los CSV para R
pnpm piloto:analizar docs/piloto/datos docs/piloto/analisis

# 3. Pruebas inferenciales y supervivencia, con la versión de R fijada
docker run --rm -v "$PWD:/w" -w /w rocker/r-ver:4.4.2 \
  Rscript tools/piloto/contraste.R docs/piloto/analisis docs/piloto/analisis/contraste

# 4. Sensibilidad: umbrales 2, 3 y 4; radios y tiempos de vida × 0,5, 1 y 1,5
pnpm piloto:sensibilidad docs/piloto/datos docs/piloto/analisis/sensibilidad.csv
```

`contraste.R` deja `contraste.csv` (Wilcoxon y Fisher unilaterales, α = 0,05 con Holm, y tamaños de efecto),
`veracidad_diferencia.csv` (diferencia de proporciones de H1c con IC), `costos_ic.csv` (intervalos de Wilson),
`descriptivos.txt` (anticipo y tasas de la tarea), `supervivencia.txt` (Kaplan-Meier por categoría) y `sesion.txt`
(versión de R y de sus paquetes). Solo usa R base y `survival`.

### Definiciones operativas (perfil v5, Tablas 3 y 6)

- **Incidente único:** un grupo del etiquetado (consenso; si no lo hay, el evaluador A; si no, el B), sin los envíos de
  reportes rechazados por moderación. Es **real** si alguno de sus reportes se verificó real o es de fuente oficial; su
  **hora de fin** es la primera verificada (6.3, nunca de los votos).
- **Clave de una instantánea:** los incidentes activos que fijan los dos evaluadores en `/evaluacion` → Congelar **antes**
  de las sesiones (6.3). No hay sesiones sin la clave de E1 y E2, y no cambia después de la primera tarea. La pantalla
  avisa si E1 o E2 no tienen de 3 a 6 incidentes o si sus reportes difieren más de 20 %.
- **H1a (participante, n ≥ 20):** segundos de la tarea; costo, tasa de acierto y de omisión sobre la clave. Wilcoxon de
  rangos con signo, r = Z/√n.
- **H1b (incidente único, n ≥ 30):** ítems por incidente: en la base, sus envíos; en la procesada, las alertas que los
  contienen. Wilcoxon de rangos con signo y delta de Cliff; costo, fusiones erróneas (alertas que juntan envíos de
  incidentes distintos) con IC de Wilson.
- **H1c (reporte verificado, n ≥ 40):** reales entre las alertas confirmadas frente a la vista base, cuya veracidad se
  pondera por estrato (categoría × confirmado) con su tamaño en el total de reportes (6.5). Exacta de Fisher, razón de
  odds y diferencia de proporciones con IC; costos, exhaustividad (reales confirmados / reales), mediana de minutos
  hasta la confirmación y porcentaje no verificable.
- **H1d (incidente con hora de fin, n ≥ 20):** minutos visible tras el fin: en la base, el último envío del incidente
  + 24 h; en la procesada, la caducidad o resolución de su última alerta. Wilcoxon de rangos con signo y delta de
  Cliff; costo, caducidad prematura (%) y minutos de anticipo.
- **Secuencias:** se sortean entre las que llevan menos sesiones (cinco participantes por secuencia, 6.3).
- **Sensibilidad (exploratoria, 6.5):** el simulador deduplica con la ubicación pública (en robos, el centro de la celda
  de 200 m), y un envío que solo en la simulación pasa a duplicado confirma con peso 1,0 (la reputación inicial). Con
  los parámetros del SRS da lo mismo que los casos de uso reales (prueba de equivalencia).
