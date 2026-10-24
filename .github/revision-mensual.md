Revisión mensual del mantenimiento (ISO/IEC 14764, [`docs/mantenimiento.md`](https://github.com/HerlanCh/PlataformaGIS/blob/main/docs/mantenimiento.md)).
Cada hallazgo se abre como incidencia con su plantilla; esta se cierra cuando la lista está completa.

## Calidad

- [ ] **SonarCloud** (rama `main`): sin problemas nuevos de seguridad o fiabilidad; duplicación < 3 %; cobertura del código nuevo ≥ 80 %.
- [ ] **CI de `main`** en verde, incluido el E2E contra staging tras la última versión.

## Dependencias

- [ ] **Dependabot**: fusionar o cerrar con motivo los PR abiertos. Una actualización mayor, como incidencia adaptativa.
- [ ] `pnpm audit --prod --audit-level high`: 0 avisos altos o críticos.
- [ ] Revisar las dependencias fijadas a propósito (TypeScript 6 por typescript-eslint) por si ya se pueden liberar.

## Operación

- [ ] **UptimeRobot**: disponibilidad del mes ≥ 95 % (RNF-05). Anotar el valor.
- [ ] **GlitchTip**: errores nuevos de la API y de la web, cada uno con incidencia correctiva o descartado con motivo.
- [ ] **Respaldo**: el workflow `Respaldo` restauró con éxito en el mes (RNF-07).
- [ ] **Planes gratuitos** (Neon, Render, Vercel): uso por debajo de los límites y sin avisos de cambios de condiciones (RSK-01, RSK-02).
- [ ] **Secretos**: ninguno vence en el mes siguiente (token de Vercel, API key de Render).

## Métricas del piloto (mientras dure)

- [ ] `pnpm piloto:metricas` del mes exportado a `docs/piloto/datos/`.
