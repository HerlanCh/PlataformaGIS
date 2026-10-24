# Informe de validación

> **Estado: plantilla.** Se completa al cierre del piloto con los datos medidos. Ninguna cifra de este documento se
> escribe sin su medición: lo que no se midió se deja como «no medido» y se explica en las limitaciones.

Fase 13 del roadmap (ISO/IEC/IEEE 12207, proceso de validación): evidencia de que la plataforma resuelve el problema
planteado. Instrumentos en [`piloto/`](piloto/README.md); indicadores y metas en la
[matriz de marco lógico](marco-logico.md).

## 1. Resumen

_Por completar: 5 a 8 líneas con el resultado principal de cada nivel de la matriz._

## 2. Contexto del piloto

| Dato | Valor |
| :-- | :-- |
| Periodo | _AAAA-MM-DD a AAAA-MM-DD_ |
| Zona | La Paz y El Alto (SRS 1.3) |
| Versión desplegada | _vX.Y.Z_ |
| Participantes incorporados | _n_ |
| Participantes que respondieron la encuesta de cierre | _n_ |
| Grupo de comparación | Grupo de WhatsApp vecinal (sin identificarlo), _n_ miembros aprox. |

## 3. Usabilidad (al inicio del piloto)

_Resumen de [`usabilidad/resultados.md`](usabilidad/resultados.md): tareas completadas, puntaje SUS, bloqueos
encontrados y corregidos, y si se confirmaron las dos hipótesis del [informe de calidad](informe-calidad.md)
(editor de zonas sin «Usar mi ubicación» y etiquetas pequeñas)._

## 4. Resultados por nivel de la matriz

### 4.1 Fin

| ID | Indicador | Meta | Medido | ¿Cumple? |
| :-- | :-- | :-- | :-- | :-- |
| F-1 | Evitaron al menos un incidente | ≥ 60 % | | |
| F-2 | Se sienten mejor informados | ≥ 70 % | | |

### 4.2 Propósito: plataforma frente al grupo de WhatsApp

_Copiar las tablas de [`piloto/resultados.md`](piloto/resultados.md) y comentarlas._

| ID | Indicador | Meta | Plataforma | Grupo | ¿Cumple? |
| :-- | :-- | :-- | :-- | :-- | :-- |
| P-1 | Mediana de minutos hasta que aparece | ≤ 0 | | | |
| P-2 | Porcentaje de ciertos | Plataforma ≥ grupo | | | |
| P-3 | Mediana de minutos visible sin ser cierto | Plataforma < grupo | | | |

### 4.3 Componentes

| ID | Indicador | Meta | Medido | ¿Cumple? |
| :-- | :-- | :-- | :-- | :-- |
| C1 | Disponibilidad (RNF-05) | ≥ 95 % | | |
| C1 | Respuestas 5xx (RNF-08) | < 1 % | | |
| C2 | Reportes comunitarios confirmados | ≥ 30 % | | |
| C2 | Mediana hasta la primera confirmación | ≤ 30 min | | |
| C3 | Cerrados por moderación | ≤ 10 % | | |
| C4 | Incidentes oficiales por semana | ≥ 5 | | |
| C5 | Mediana de personas activas por día | ≥ 10 | | |
| C6 | Puntaje SUS | ≥ 68 | | |
| C6 | Completan las 3 tareas sin ayuda | ≥ 4 de 5 | | |

## 5. Clasificador con IA (Fase 10, paso 3)

_Resultado de `pnpm clasificador:exportar` y `pnpm clasificador:evaluar` sobre las descripciones moderadas del
piloto. El modelo se despliega solo si supera al clasificador por reglas; si no hubo suficientes ejemplos, decirlo._

## 6. Limitaciones

_Por completar. Candidatas: tamaño y selección de la muestra; un solo grupo de comparación; comprobación de la verdad
por un único observador; las métricas solo cuentan desde que se activa `FEATURE_METRICS`; incidentes del grupo que no
llegan a la plataforma y viceversa; efecto novedad de 4 semanas._

## 7. Trabajo futuro

- **Rutas alternas:** sugerir un desvío alrededor de los incidentes vigentes (fuera del alcance del SRS 1.2).
- **Botón de pánico:** fuera del alcance por diseño; requiere coordinación con las líneas de emergencia.
- _Agregar lo que surja de la pregunta 9 de la encuesta y de las sesiones de usabilidad._

## 8. Conclusión

_¿La plataforma resolvió el problema planteado? Responder con los indicadores, no con impresiones._
