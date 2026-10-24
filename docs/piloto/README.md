# Piloto (Fase 13)

| Documento | Para qué |
| :-- | :-- |
| [`protocolo.md`](protocolo.md) | Alcance, roles, calendario, consentimiento y privacidad |
| [`guia-instalacion.md`](guia-instalacion.md) | Para los participantes: instalar la PWA y activar avisos |
| [`encuesta-impacto.md`](encuesta-impacto.md) | Encuesta de cierre: indicadores del Fin (F-1 y F-2) |
| [`plantilla-whatsapp.csv`](plantilla-whatsapp.csv) | Planilla del grupo de comparación |
| [`plantilla-verificacion.csv`](plantilla-verificacion.csv) | Muestra de reportes de la plataforma comprobados por el observador |
| `datos/` | Exportaciones reales del piloto (se crea al empezar). Sin datos personales |
| `resultados.md` | Lo genera `pnpm piloto:analizar` al cierre |

La usabilidad usa los instrumentos de la Fase 11: [`../usabilidad/`](../usabilidad/guion.md).

## Fechas

Todas las fechas van en **ISO 8601 con zona horaria**: `2026-11-03T08:15-04:00` (hora de Bolivia). El análisis
rechaza formatos como `3/11/2026 8:15`, que son ambiguos.

## Planilla del grupo de WhatsApp

Una fila por incidente publicado en el grupo, sea cierto o no. Columnas de
[`plantilla-whatsapp.csv`](plantilla-whatsapp.csv):

| Columna | Contenido |
| :-- | :-- |
| `id_incidente` | `W-001`, `W-002`… |
| `publicado_en` | Hora del primer mensaje que lo menciona |
| `categoria` | `bloqueo`, `accidente`, `robo`, `infraestructura`, `jauria` u `otra` |
| `zona` | Barrio o avenida, aproximada. **Nunca** una dirección exacta |
| `cierto` | `si`, `no` o `no_se_sabe`, según lo que el observador pudo comprobar (en persona, por una fuente oficial o por varias personas del grupo) |
| `dejo_de_ser_cierto_en` | Cuándo dejó de ocurrir: se levantó el bloqueo, se retiró el vehículo… Vacío si sigue o no se sabe. En un incidente falso, la misma hora de publicación |
| `desmentido_en` | Cuándo alguien del grupo avisó que ya no ocurría o que era falso. Vacío si nadie lo hizo |
| `id_reporte_plataforma` | Id del reporte de la plataforma que corresponde al mismo incidente (el moderador lo ve en `/moderacion` o en el CSV de métricas). Vacío si no apareció |
| `notas` | Libre, **sin nombres, teléfonos ni descripciones de personas** |

## Planilla de verificación de la plataforma

El observador comprueba una muestra de reportes **comunitarios** de la plataforma: al menos 3 por semana, elegidos
sin mirar si están confirmados (por ejemplo, el primero de cada mañana en su zona). Columnas de
[`plantilla-verificacion.csv`](plantilla-verificacion.csv):

| Columna | Contenido |
| :-- | :-- |
| `id_reporte` | Id del reporte |
| `cierto` | `si`, `no` o `no_se_sabe` |
| `dejo_de_ser_cierto_en` | Igual que en la planilla del grupo |
| `notas` | Libre, sin datos personales |

## Análisis al cierre

```sh
pnpm piloto:metricas <inicio> <fin> docs/piloto/datos/metricas.csv
pnpm piloto:analizar docs/piloto/datos/metricas.csv docs/piloto/datos/whatsapp.csv \
  docs/piloto/datos/verificacion.csv 2026-11-30T23:59:59-04:00 docs/piloto/resultados.md
```

`pnpm piloto:metricas` necesita `DATABASE_URL` de producción en la terminal (nunca en el repositorio). El análisis
compara solo los reportes de la comunidad: los incidentes oficiales (HU-13) se excluyen.
