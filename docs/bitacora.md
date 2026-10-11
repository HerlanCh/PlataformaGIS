# Bitácora de Desarrollo del Proyecto

Registro cronológico de decisiones, avances por fase, cambios arquitectónicos y reflexiones técnicas para la Plataforma GIS de alerta temprana.

---

## [2026-10-11] — Cierre de Fase 0: Gobernanza y Requisitos

### Objetivo de la Fase
Establecer la base normativa, de calidad y de especificación formal previa a la escritura de código, cumpliendo los procesos de definición de necesidades y requisitos de **ISO/IEC/IEEE 12207** y fijando las metas del modelo de calidad **ISO/IEC 25010**.

### Artefactos Generados
1. **[`docs/glosario.md`](file:///c:/Users/STRAY/Desktop/PlataformaGIS/docs/glosario.md):** Lenguaje ubicuo del dominio (Reporte, Categoría, Confirmación, Negación, Caducidad, Reputación, Celda Geográfica, Idempotencia).
2. **[`docs/calidad.md`](file:///c:/Users/STRAY/Desktop/PlataformaGIS/docs/calidad.md):** Modelo de calidad ISO/IEC 25010 con 13 Requisitos No Funcionales (RNF-01 a RNF-13) cuantitativos y herramientas de verificación de CI/CD.
3. **[`docs/riesgos.md`](file:///c:/Users/STRAY/Desktop/PlataformaGIS/docs/riesgos.md):** Registro de riesgos técnicos y operativos (suspensión por inactividad, mapa vacío, cuotas de planes gratuitos, mitigación de spam).
4. **[`docs/dod.md`](file:///c:/Users/STRAY/Desktop/PlataformaGIS/docs/dod.md):** Definición de Hecho (DoD) formal para tareas, historias de usuario y fases.
5. **[`docs/adr/ADR-001.md`](file:///c:/Users/STRAY/Desktop/PlataformaGIS/docs/adr/ADR-001.md):** Arquitectura del sistema: Monolito modular con arquitectura hexagonal en monorepo pnpm.
6. **[`docs/adr/ADR-002.md`](file:///c:/Users/STRAY/Desktop/PlataformaGIS/docs/adr/ADR-002.md):** Stack tecnológico y estrategia de costo cero (TypeScript, Fastify, Socket.io, React+Vite PWA, PostgreSQL+PostGIS, Leaflet).
7. **[`docs/srs.md`](file:///c:/Users/STRAY/Desktop/PlataformaGIS/docs/srs.md):** Especificación de requisitos según ISO/IEC/IEEE 29148, incluyendo tabla de categorías del MVP con TTL, radios de deduplicación, reglas de privacidad, reglas numéricas de verificación y ponderación de votos por reputación, e historias de usuario (HU-01 a HU-12) con escenarios Dado/Cuando/Entonces.
8. **[`docs/trazabilidad.md`](file:///c:/Users/STRAY/Desktop/PlataformaGIS/docs/trazabilidad.md):** Matriz de trazabilidad que conecta RNF, Historias de Usuario, casos de uso y casos de prueba.

### Criterio de Salida de Fase 0
- [x] SRS con todas las historias Imprescindibles y sus criterios de aceptación.
- [x] Tabla de categorías con TTL y reglas de verificación con valores numéricos.
- [x] RNF ISO/IEC 25010 con umbrales cuantitativos.
- [x] ADR-001 y ADR-002 redactados y aprobados.
- [x] Registro de riesgos y DoD publicados.

**Estado:** Fase 0 completada al 100 %. Listo para dar inicio a la Fase 1 (Base arquitectónica y cadena de calidad).
