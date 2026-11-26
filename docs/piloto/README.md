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
`costos_ic.csv` (intervalos de Wilson), `supervivencia.txt` (Kaplan-Meier por categoría) y `sesion.txt` (versión de R
y de sus paquetes). Solo usa R base y `survival`.

### Definiciones operativas (provisionales hasta fijarlas en el protocolo con el perfil v5)

- **Incidente real:** el grupo del etiquetado (consenso; si no lo hay, el evaluador A) con al menos un reporte
  verificado como real, o de fuente oficial. Su fin es la primera hora de fin verificada.
- **Clave de una instantánea:** los incidentes reales y no terminados en su instante que aparecen en alguna de sus dos
  vistas.
- **H1a:** tiempo de la tarea y aciertos (incidentes de la clave marcados); costo, omisiones.
- **H1b:** marcados de más y puntos por incidente real; costo, fusiones erróneas (reportes que juntaron envíos de
  incidentes distintos).
- **H1c:** reales entre lo confirmado frente a lo no confirmado; costos, reales sin confirmar y latencia de
  confirmación.
- **H1d:** minutos visibles después del fin (procesada: hasta cerrarse o vencer; base: 24 h después del último envío);
  costo, caducidad prematura (salió del mapa antes de terminar).
- **Sensibilidad:** el simulador deduplica con la ubicación pública (en robos, el centro de la celda de 200 m), y un
  envío que solo en la simulación pasa a duplicado confirma con peso 1,0 (la reputación inicial). Con los parámetros
  del SRS da lo mismo que los casos de uso reales (prueba de equivalencia).
