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

---

## [2026-10-11] — Cierre de Fase 1: Base arquitectónica y cadena de calidad

### Resultado
Un esqueleto que compila, se prueba y se despliega, con la arquitectura hexagonal impuesta por la CI. Versión publicada: `v1.0.0`.

### Qué se construyó
- **Monorepo pnpm** con TypeScript estricto, ESLint (complejidad máxima 10), Prettier, Husky, Commitlint y Vitest con umbrales de cobertura por capa.
- **Paquetes base:** `shared-kernel`, `contracts`, `event-bus` (bus en memoria) y `platform` (configuración validada con Zod, interruptores `FEATURE_<MODULO>`, logger pino, pool de PostgreSQL).
- **Generador de módulos** (`pnpm gen:module`) y los nueve módulos de la arquitectura como esqueletos. El registro de módulos y las referencias de TypeScript se generan con `tools/modules/sync-modules.mjs`.
- **Reglas de arquitectura** en `.dependency-cruiser.cjs`, con una prueba automática que planta siete importaciones prohibidas y exige que todas se detecten.
- **API mínima:** `GET /health` (versión y estado de la base de datos), ID de correlación por solicitud y `ping` por Socket.io cada 5 s.
- **PWA mínima:** mapa Leaflet centrado en La Paz que muestra el último `ping`. JS inicial: 125 KB comprimido.
- **CI** con compuertas independientes: lint, typecheck, arquitectura, duplicación, pruebas con cobertura, build, auditoría y SonarCloud. Dependabot y semantic-release activos.
- **Staging:** API en Render, web en Vercel y base de datos en Neon con PostGIS.

### Evidencia del criterio de salida
- [x] **CI en verde con todas las compuertas activas.** Ejecución en `main` con SonarCloud incluido: compuerta de calidad `OK`, 0 bugs, 0 vulnerabilidades, 0 % de duplicación, 97,5 % de cobertura.
- [x] **Un PR que viola la arquitectura es rechazado.** PR #2 (un dominio importa infraestructura) rechazado por `dominio-solo-shared-kernel`; PR #3 (un módulo importa otro módulo) rechazado por `modulo-no-importa-otro-modulo`. Ambos cerrados sin fusionar.
- [x] **`/health` y el `ping` funcionan en staging.** `https://plataforma-gis-api.onrender.com/health` responde 200 con la base de datos arriba; un cliente recibe el `ping` por WebSocket a través del proxy de Render con el origen de `https://plataformagis-apps.vercel.app`. No hizo falta cambiar a Oracle Cloud.
- [x] **Un módulo se puede apagar y eliminar.** Con un módulo `sandbox` generado con plop: `FEATURE_SANDBOX=false` devuelve 404 y no procesa su evento; al borrar la carpeta y sincronizar, todo compila y las pruebas siguen en verde.

### Hallazgos
- **Error corregido (prueba primero):** al caerse la base de datos, el pool de `pg` emitía un `error` sin oyente y terminaba el proceso. Lo detectó la CI en la prueba de integración de `/health`.

### Desviaciones y decisiones
- **TypeScript 6, no 7:** typescript-eslint aún no admite la serie 7.
- **Auditoría bloqueante solo en producción:** `braces` tiene una vulnerabilidad alta sin versión corregida y entra únicamente por herramientas de desarrollo (plop, semantic-release). La auditoría de desarrollo se ejecuta como paso informativo. Revisar cuando exista un parche.
- **Un solo PR para toda la fase**, en lugar de los cuatro previstos en el plan.
- **Iconos de la PWA:** por ahora un SVG; los PNG definitivos llegan en la Fase 8.

### Pendientes que pasan a la siguiente fase
- **Proteger `main`:** resuelto el mismo día. Una regla exige PR y CI en verde; semantic-release escribe `CHANGELOG.md` con una clave de despliegue que la regla admite como excepción. Comprobado con la publicación de `v1.1.0`.
- **Rama remota `master`:** se conserva por decisión del autor; no afecta al flujo.
- **Alinear la versión de PostgreSQL:** Neon usa la 18 y la imagen local y de pruebas es la 17. Resolver antes de las migraciones de la Fase 3.
- **Contraseña de la base de datos de staging:** se rotará más adelante por decisión del autor.

---

## [2026-10-11] — Cierre de Fase 2: Modelo de dominio

### Resultado
Las reglas de negocio de los módulos Imprescindibles están escritas en TypeScript puro dentro de `domain/`, sin base de datos, HTTP ni frameworks, y probadas contra los valores del SRS.

### Qué se construyó
- **`shared-kernel`:** `GeoPoint` como objeto de valor que rechaza coordenadas fuera del área de servicio y mide distancias; constructores validados de `ReportId`, `UserId` y `CategoryCode`.
- **`contracts`:** los siete eventos de integración versionados, cada uno marcado como público o interno.
- **`identity`:** entidad `User` y puerto `UserRepository`.
- **`reports`:** `Category` con el catálogo del MVP, agregado `Report` con su máquina de estados y extensiones de vigencia, `ExpirationPolicy`, `PrivacyPolicy` y cuatro puertos.
- **`verification`:** `Vote`, `Reputation`, `VerificationPolicy`, `ReputationPolicy` y tres puertos.
- **README** de los tres módulos con su contrato: responsabilidad, eventos, puertos y tablas.

### Evidencia del criterio de salida
- [x] **Cobertura del dominio ≥ 95 %.** Vitest impone el umbral en `**/domain/**` y en `shared-kernel`; la suite pasa con 394 pruebas y una cobertura global del 99,7 % de sentencias y 100 % de líneas.
- [x] **0 dependencias externas en los dominios y en `shared-kernel`.** dependency-cruiser sin violaciones (reglas `dominio-solo-shared-kernel` y `shared-kernel-sin-dependencias`).
- [x] **Puertos y eventos definidos, con README e incluidos en la trazabilidad.** Sección 3 de `trazabilidad.md`.

### Pruebas destacadas
- **Máquina de estados:** las 7 transiciones válidas y las 13 inválidas, generadas desde la tabla de transiciones.
- **Basadas en propiedades (fast-check):** `GeoPoint`, `ExpirationPolicy`, `PrivacyPolicy`, `VerificationPolicy` y la proyección UTM.
- **Proyección UTM 19 Sur:** coincide con `ST_Transform` de PostGIS 3.5 con menos de 1 mm de diferencia en seis puntos del área de servicio.

### Decisiones de diseño (aprobadas en el plan de la fase)
1. **La ubicación pública se calcula en el dominio.** `PrivacyPolicy` usa una proyección UTM 19 Sur propia, sin librerías. El repositorio de la Fase 4 guardará esa ubicación tal cual; se ajustó el punto 6 de la Fase 4 del roadmap.
2. **Audiencia de los eventos.** Los eventos públicos solo llevan `publicLocation`; una prueba impide que incluyan la ubicación real o un usuario. `ReportDuplicateDetected` y `VoteCast` son internos.
3. **La decisión de verificación viaja en `VoteCast.v1`** (`NONE`, `CONFIRM`, `EXTEND`, `RESOLVE`). `verification` nunca modifica un reporte.
4. **Puertos añadidos** a los del roadmap: `UserRepository` y `AuthorStanding`.

### Reglas precisadas al implementar
El SRS no las detallaba; se resolvieron así y conviene revisarlas:
- **Prioridad de las negaciones.** Si un reporte reúne a la vez los umbrales de confirmación y de resolución, se resuelve.
- **Un usuario silenciado no gana reputación** por aciertos o reportes anteriores; solo se recupera por el plazo de 30 días.
- **Redondeo a dos decimales** en reputaciones y sumas de votos, para que los pasos de 0,05 no acumulen error.
- **En el instante exacto de la caducidad el reporte sigue vigente**; caduca cuando esa fecha ya pasó.
- **Borde del área de servicio.** Si el centro de la celda de 200 m cae fuera del rectángulo, la ubicación pública se acota al borde.
- **La descripción del reporte no se modeló.** El roadmap la prevé como paso posterior de la PWA (Fase 8) y el SRS no fija su longitud; se añadirá con su regla cuando se defina.

### Publicación de versiones
El primer PR de la fase publicó `v1.1.0`: semantic-release escribió el `CHANGELOG.md` en `main` protegida con la clave de despliegue, lo que cierra la comprobación que quedó abierta en la Fase 1.

### Pendientes que pasan a la siguiente fase
- **Alinear la versión de PostgreSQL** (Neon 18, local y pruebas 17) antes de las migraciones.
