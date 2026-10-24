# Proceso de mantenimiento

Fase 13 (ISO/IEC 14764 e ISO/IEC/IEEE 12207, proceso de mantenimiento). Rige desde la entrada en producción y
sigue después del piloto.

## 1. Clasificar cada incidencia

Toda incidencia se abre con una de las cuatro plantillas de `.github/ISSUE_TEMPLATE/`; no se admiten incidencias en
blanco. La plantilla le pone su etiqueta:

| Tipo | Etiqueta | Cuándo | Ejemplos |
| :-- | :-- | :-- | :-- |
| Correctivo | `correctiva` | Algo no hace lo que dice el SRS | Un reporte no aparece en vivo; un 5xx en GlitchTip |
| Adaptativo | `adaptativa` | Cambió algo externo | Node nuevo; un proveedor cambia su plan gratuito; iOS cambia los avisos |
| Perfectivo | `perfectiva` | Mejora o función nueva | Bloqueos de la prueba de usabilidad; pedidos de la encuesta de impacto |
| Preventivo | `preventiva` | Evitar un fallo futuro | Dependencia sin mantenimiento; deuda señalada por SonarCloud; revisión mensual |

Un fallo de seguridad no se abre como incidencia pública: se reporta en privado (Security → Report a vulnerability).

**Prioridad:** primero lo correctivo crítico o alto (datos expuestos, reportes perdidos, app caída), después lo
adaptativo con fecha límite y al final lo demás.

## 2. Corregir con la prueba primero

1. Rama corta desde `main`: `fix/<tema>` para lo correctivo; `feat/`, `chore/` o `refactor/` para lo demás.
2. **Escribir la prueba que reproduce el fallo y verla fallar**, con el ID de la historia (`HU-xx: …`). Si el fallo
   no tiene historia, se nombra por el requisito (`RNF-xx: …`).
3. Arreglar hasta que pase, sin tocar la prueba.
4. PR con la plantilla: marca el tipo y confirma que la prueba se escribió antes. Conventional Commits; el PR cierra
   la incidencia («Cierra #123»).
5. Las compuertas de la CI (cobertura, complejidad, duplicación, arquitectura, auditoría, SonarCloud) valen igual
   que en el desarrollo.
6. Despliegue a producción solo por el workflow `Produccion` ([runbook](runbook.md)).

## 3. Revisión mensual

El día 1 de cada mes el workflow `Revision mensual` abre una incidencia `preventiva` con la lista de
[`.github/revision-mensual.md`](../.github/revision-mensual.md):

- SonarCloud y la CI de `main`;
- PR de Dependabot y `pnpm audit`;
- disponibilidad en UptimeRobot (RNF-05), errores en GlitchTip y restauración del respaldo;
- uso de los planes gratuitos y vencimiento de secretos.

Cada hallazgo se abre como incidencia propia. La revisión se cierra cuando la lista está completa. Se puede abrir a
mano con `gh workflow run "Revision mensual"`; si la del mes ya existe, no se duplica.

## 4. Registro

- Cada versión queda en `CHANGELOG.md` (semantic-release).
- Las decisiones que cambian la arquitectura o el stack van en un ADR nuevo (`docs/adr/`).
- Los cambios de proceso se anotan en `docs/bitacora.md`.
