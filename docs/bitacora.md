# Bitácora de Desarrollo del Proyecto

Registro cronológico de decisiones, avances por fase, cambios arquitectónicos y reflexiones técnicas para la Plataforma GIS de alerta temprana.

---

## [2026-10-11] — Cierre de Fase 0: Gobernanza y Requisitos

### Objetivo de la Fase
Establecer la base normativa, de calidad y de especificación formal previa a la escritura de código, cumpliendo los procesos de definición de necesidades y requisitos de **ISO/IEC/IEEE 12207** y fijando las metas del modelo de calidad **ISO/IEC 25010**.

### Artefactos Generados
1. **[`glosario.md`](glosario.md):** Lenguaje ubicuo del dominio.
2. **[`calidad.md`](calidad.md):** Modelo de calidad ISO/IEC 25010 con requisitos no funcionales cuantitativos y herramientas de verificación.
3. **[`riesgos.md`](riesgos.md):** Registro de riesgos técnicos y operativos con mitigación.
4. **[`dod.md`](dod.md):** Definición de Hecho (DoD) para tareas, historias de usuario y fases.
5. **[`adr/ADR-001.md`](adr/ADR-001.md):** Monolito modular con arquitectura hexagonal en monorepo pnpm.
6. **[`adr/ADR-002.md`](adr/ADR-002.md):** Stack tecnológico y estrategia de costo cero.
7. **[`srs.md`](srs.md):** Especificación de requisitos según ISO/IEC/IEEE 29148: categorías del MVP, reglas numéricas de verificación e historias de usuario (HU-01 a HU-12).
8. **[`trazabilidad.md`](trazabilidad.md):** Matriz requisito → historia → caso de uso → caso de prueba.

---

## [2026-10-11] — Revisión y corrección de la Fase 0

Una revisión de los artefactos anteriores encontró contradicciones entre documentos, reglas de negocio sin definir y contenido que no provenía del roadmap. Se corrigió antes de iniciar la Fase 1.

### Decisiones tomadas (confirmadas por el autor el 2026-10-11)
1. **Comunicación entre módulos:** un módulo nunca importa a otro, tampoco su `index.ts`. Las consultas entre módulos usan un puerto del módulo consumidor que conecta la raíz de composición. Unificado en ADR-001, DoD y roadmap.
2. **Dueño de la reputación:** el módulo `verification`, con tabla propia `reputations`. Se quita la columna `reputation` de `users`.
3. **Extensiones de vigencia:** la primera al pasar a `CONFIRMADO` (suma 3.0) y la segunda al alcanzar suma 6.0; ninguna más.
4. **Confirmar y resolver exigen al menos 2 votantes distintos**, además de la suma ponderada de 3.0.
5. **Silenciado recuperable:** la penalización por rechazo baja de 1.00 a 0.50 y la reputación vuelve a 0.5 tras 30 días sin penalizaciones. Los reportes de un silenciado se crean `ACTIVO` y pasan de inmediato a `RECHAZADO`, respetando la máquina de estados.
6. **Deduplicación por evento:** `reports` emite `ReportDuplicateDetected.v1` y `verification` lo registra como confirmación, en lugar de una llamada directa entre módulos.
7. **Rectángulo geográfico ampliado** a latitud [-16.67, -16.38] y longitud [-68.33, -68.00]. El anterior dejaba fuera Chasquipampa, Ovejuyo, Achumani, Cota Cota, Senkata, Ventilla y el Distrito 7 de El Alto (contrastado con OpenStreetMap).
8. **Parámetros nuevos** (SRS 3.3): límites de reportes y votos, máximo de zonas, distancia máxima para votar (1000 m) y tamaño de celda del mapa de calor.
9. **HU-10 alineada con la Fase 10:** el clasificador marca reportes sospechosos para moderación; no sugiere categorías.
10. **RNF-14 (privacidad)** añadido para dar ID trazable a la regla de no exponer `location` ni `author_id`.

### Otros cambios
- SRS reestructurado según ISO/IEC/IEEE 29148: interesados, restricciones, supuestos, requisitos funcionales con ID (RF-01 a RF-17), interfaces externas y verificación.
- HU-06 a HU-12 con criterios de aceptación Dado/Cuando/Entonces; escenarios añadidos en HU-01 a HU-05.
- Registro de riesgos depurado: se retiran mitigaciones ajenas al stack o de pago (ingesta de redes sociales, límite por IP) y se añaden RSK-08 (PWA en iOS) y RSK-09 (política de teselas de OSM).
- Matriz de trazabilidad con columna de requisito; el bot deja de figurar como módulo.
- RNF-09 sin la carga de 50 req/s, que no estaba en el roadmap.
- Enlaces de esta bitácora cambiados a rutas relativas.

### Criterio de Salida de Fase 0
- [x] SRS con todas las historias Imprescindibles y sus criterios de aceptación.
- [x] Tabla de categorías con TTL y reglas de verificación con valores numéricos.
- [x] RNF ISO/IEC 25010 con umbrales cuantitativos.
- [x] ADR-001 y ADR-002 aprobados por el autor del proyecto.
- [x] Registro de riesgos y DoD publicados.

**Estado:** Fase 0 completada al 100 %. Lista para iniciar la Fase 1 (Base arquitectónica y cadena de calidad).

### Pendientes fuera de los documentos
- La rama del repositorio es `master`; el flujo definido usa `main` (se resuelve en el paso 1 de la Fase 1).
- Actualizar la matriz de marco lógico: Next.js cambia a Vite.
