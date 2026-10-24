# Protocolo del piloto

Fase 13 (ISO/IEC 12207, validación). Objetivo: medir los indicadores de la [matriz de marco lógico](../marco-logico.md)
con personas reales y compararlos con un grupo de WhatsApp vecinal.

## Alcance

- **Zona:** todo el rectángulo de servicio del SRS 1.3 (La Paz y El Alto).
- **Duración:** 4 semanas seguidas (propuesta). No cambiarla a mitad del piloto.
- **Entorno:** producción, `https://plataforma-gis-produccion.vercel.app`. Staging no se usa con participantes.
- **Participantes:** al menos 20 vecinos mayores de 18 años, sin relación laboral con el proyecto. 5 de ellos hacen
  además la prueba de usabilidad.
- **Grupo de comparación:** un grupo de WhatsApp vecinal activo (al menos un incidente por semana) al que pertenezca el
  observador.

## Roles

| Rol | Quién | Qué hace |
| :-- | :-- | :-- |
| Responsable | Autor del proyecto | Incorpora a los participantes, hace las sesiones de usabilidad, exporta los datos y redacta el informe |
| Moderador | Autor u otra persona con rol `MODERADOR` | Revisa la cola y publica los incidentes oficiales (HU-13) |
| Observador | Integrante del grupo de WhatsApp | Llena la [planilla del grupo](README.md#planilla-del-grupo-de-whatsapp) y comprueba una muestra de reportes de la plataforma |

Una misma persona puede tener más de un rol. El observador no debe avisar al grupo de los reportes de la plataforma
ni al revés: contaminaría la comparación.

## Calendario

| Semana | Actividades |
| :-- | :-- |
| 0 (antes) | Aprobar la matriz de marco lógico. Activar `FEATURE_METRICS` en producción y comprobar que `GET /v1/moderacion/metricas` responde. Elegir el grupo de WhatsApp. Preparar el moderador con el workflow `Administracion` |
| 1 | Incorporar a los participantes con la [guía de instalación](guia-instalacion.md). Hacer las 5 sesiones de usabilidad ([guion](../usabilidad/guion.md)) y corregir los bloqueos. Empezar las planillas |
| 1 a 4 | Moderar y publicar incidentes oficiales a diario. Llenar las planillas. Exportar las métricas cada semana |
| 4 (cierre) | Aplicar el SUS a todos y la [encuesta de impacto](encuesta-impacto.md). Exportar las métricas finales. Correr el análisis |
| Después | Exportar el conjunto etiquetado del clasificador y evaluarlo (Fase 10, paso 3). Redactar el [informe de validación](../informe-validacion.md) |

## Rutina diaria del moderador

1. **Fuentes oficiales, dos veces al día** (alrededor de las 7:30 y de las 17:30): revisar las cuentas públicas de
   Tránsito, de la ABC (transitabilidad) y de Mi Teleférico. Por cada corte o desvío vigente en el área:
   1. ubicarlo en el mapa de la app;
   2. abrir `/moderacion` → *Publicar incidente oficial*;
   3. elegir categoría y fuente, y publicar.
2. **Cola de moderación**, al menos una vez al día: rechazar lo falso o lo que identifica a una persona; mantener lo
   demás.
3. No publicar como oficial nada que no venga de una fuente oficial.

## Planillas y exportaciones

- Las planillas viven en una hoja de cálculo compartida solo con el equipo. Al cierre se exportan a CSV con el formato
  de [`README.md`](README.md).
- Cada semana: `pnpm piloto:metricas <inicio> <hoy> docs/piloto/datos/metricas-semana-N.csv`, con `DATABASE_URL` de
  producción en una terminal local. **No** se pega esa cadena en el chat ni en el repositorio: se lee del gestor de
  contraseñas.
- UptimeRobot: al cierre, anotar el porcentaje de disponibilidad del periodo (RNF-05).

## Consentimiento informado

Antes de incorporar a una persona, léele esto o dáselo por escrito:

> «Te invito a probar durante 4 semanas una aplicación para avisar de incidentes en La Paz y El Alto. Es parte de un
> proyecto de grado. La app no te pide nombre, teléfono ni correo: solo identifica tu teléfono con un código anónimo.
> La ubicación exacta de lo que reportes no se muestra a nadie. No reportes fotos ni descripciones de personas. La
> app **no reemplaza** a las líneas de emergencia (110 Policía, 118 Ambulancia, 119 Bomberos). Al final te haré
> una encuesta corta y anónima. Puedes dejarlo cuando quieras, sin dar explicaciones.»

Se registra solo cuántas personas aceptaron, no quiénes.

## Privacidad y ética

- **Ningún dato personal en las planillas ni en el repositorio:** sin nombres, números de teléfono, capturas del
  grupo, fotos ni descripciones de personas. Del grupo se anota el hecho, no quién lo publicó.
- La zona se escribe de forma aproximada (barrio o avenida), nunca una dirección exacta.
- Las encuestas son anónimas: se numeran, no se nombran.
- Los datos de la plataforma ya son anónimos: las métricas no guardan autor, votantes ni ubicación (módulo
  `metrics`).
- Si alguien pide salir, se dejan de usar sus respuestas a la encuesta; lo que reportó ya es anónimo y no se puede
  separar.

## Si algo sale mal

| Problema | Qué hacer |
| :-- | :-- |
| La app no carga o UptimeRobot avisa | Seguir el [runbook](../runbook.md). Anotar el corte en el informe |
| Un reporte expone a una persona | Rechazarlo desde la cola de inmediato |
| El grupo de WhatsApp deja de estar activo | Seguir con la plataforma y anotarlo como limitación; no cambiar de grupo a mitad del piloto |
| Pocos participantes activos | Insistir en la semana 2 con un recordatorio. No regalar nada a cambio de reportes: sesgaría los datos |
