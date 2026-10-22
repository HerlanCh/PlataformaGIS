# Informe de calidad (ISO/IEC 25010)

Cierre de la verificación integral de la Fase 11: el valor medido de cada requisito no funcional, frente a su umbral y
con enlace a la evidencia.
- Metas y umbrales: [`calidad.md`](calidad.md).
- Trazabilidad de requisitos y pruebas: [`trazabilidad.md`](trazabilidad.md).

- **Versión verificada:** `v2.12.2` (commit `4e4df1b`, 2026-10-22).
- **Entornos:**
  - **staging:** API en Render (plan gratuito, Virginia), base en Neon (PostgreSQL 18 y PostGIS 3.6) y PWA en Vercel;
  - **local:** API compilada en modo producción y PostGIS 18-3.6 en Docker con 100.000 reportes sintéticos (AMD Ryzen
    5 5600G, 16 GB).

## Resumen

**13 de 14 RNF cumplen. RNF-05 queda con desviación aceptada:** solo se puede medir durante el piloto. No hay
defectos críticos ni altos abiertos.

| ID | Característica | Métrica | Umbral | Valor medido | Resultado | Evidencia |
| :-- | :-- | :-- | :-- | :-- | :-: | :-- |
| RNF-01 | Modularidad | Violaciones de la regla de dependencia | 0 | **0** (417 módulos, 1772 dependencias) | Cumple | `pnpm depcruise` en cada CI |
| RNF-02 | Analizabilidad | Complejidad ciclomática por función | ≤ 10 | **0 funciones por encima** (la regla de ESLint es error) | Cumple | `pnpm lint` en cada CI |
| RNF-03 | Modificabilidad | Código duplicado | < 3 % | **1,28 %** (jscpd), 0,0 % (SonarCloud) | Cumple | `pnpm duplication`, [SonarCloud](https://sonarcloud.io/dashboard?id=HerlanCh_PlataformaGIS) |
| RNF-04 | Capacidad de prueba | Cobertura dominio / aplicación / global | 95 / 85 / 75 % | **100 / 99,3 / 95,9 %** | Cumple | [Mantenibilidad](#mantenibilidad) |
| RNF-05 | Disponibilidad | Tiempo en línea durante el piloto | ≥ 95 % | No medible antes del piloto; UptimeRobot vigila `/health` cada 5 min desde la Fase 7 | **Desviación aceptada** | [Desviaciones](#desviaciones-aceptadas) |
| RNF-06 | Tolerancia a fallos | Reportes perdidos ante cortes | 0 | **0 perdidos y 0 duplicados** en las pruebas 3.1, 3.2 y 3.3 | Cumple | [`tolerancia-fallos.md`](rendimiento/tolerancia-fallos.md) |
| RNF-07 | Recuperabilidad | Restauración probada | 1 por versión | **4 restauraciones exitosas** del 21 y 22 de octubre, con conteos idénticos al origen; la última sobre `v2.12.2` | Cumple | [`respaldo.md`](operacion/respaldo.md), flujo `Respaldo` |
| RNF-08 | Ausencia de fallos | Tasa de 5xx | < 1 % | **0 %** en 43.554 solicitudes de carga y en el escaneo activo de ZAP | Cumple | [`verificacion-fase-11.md`](rendimiento/verificacion-fase-11.md) |
| RNF-09 | Comportamiento temporal | p95 de la API (carga de referencia) | < 300 ms | **19 ms** local con 100.000 reportes; **261 ms** en staging | Cumple | [`verificacion-fase-11.md`](rendimiento/verificacion-fase-11.md) |
| RNF-10 | Comportamiento temporal | p95 de difusión con 500 clientes | < 2 s | **337 ms** local; **708 ms** en staging; 1000 de 1000 entregas | Cumple | [`verificacion-fase-11.md`](rendimiento/verificacion-fase-11.md) |
| RNF-11 | Comportamiento temporal | p95 de consulta espacial con 100.000 reportes | < 100 ms | **42,4 ms** el peor caso (mapa de calor de toda el área) | Cumple | [`consultas-espaciales.md`](rendimiento/consultas-espaciales.md) |
| RNF-12 | Utilización de recursos | JS inicial de la PWA, comprimido | < 250 KB | **152 KB** | Cumple | `tools/presupuesto/js-inicial.mjs` y Lighthouse CI en cada CI |
| RNF-13 | Seguridad | Vulnerabilidades altas o críticas | 0 | **0** en dependencias de producción; **0** altos en ZAP completo (staging y local) | Cumple | [`owasp-top-10.md`](seguridad/owasp-top-10.md) |
| RNF-14 | Privacidad | Respuestas públicas con `location` o `author_id` | 0 | **0**: API REST, WebSocket y datos abiertos | Cumple | Prueba de privacidad sobre todas las rutas; `HU-11: la tabla no tiene columnas de usuario…` |

## Defectos encontrados en la verificación

| # | Defecto | Severidad | Prueba que lo encontró | Estado |
| :-: | :-- | :-- | :-- | :-- |
| 1 | Con la base de datos caída, la API respondía `500 ERROR_INTERNO` en lugar de `503` | Media | 3.1, base detenida 60 s | Corregido en `v2.12.1` (PR #41), con prueba primero |
| 2 | SSRF ciego: el `endpoint` de Web Push aceptaba cualquier URL `https`, también interna | Media | 6, revisión del OWASP Top 10 (A10) | Corregido en `v2.12.2` (PR #45), con prueba primero |
| 3 | Dos dependencias de desarrollo con vulnerabilidades altas y parche publicado (`tmp`, `basic-ftp`) | Alta, solo en la CI | 6, `pnpm audit` | Corregido con `overrides` (PR #45) |

Los guiones de carga también tenían errores propios: `DELETE` con `content-type` vacío, votos sobre el límite y
reintentos que agotaban el cupo de reportes. Se corrigieron en el PR #44. No eran defectos del producto.

**Defectos críticos o altos abiertos: 0.**

## Mantenibilidad

**SonarCloud** (rama `main`, 2026-10-22):

| Medida | Valor |
| :-- | :-- |
| Compuerta de calidad | **OK** |
| Calificaciones de mantenibilidad, fiabilidad y seguridad | **A / A / A** |
| Bugs / vulnerabilidades / puntos sensibles de seguridad | 0 / 0 / 0 |
| Deuda técnica | 313 min (≈ 5 h), índice de deuda 0,1 % |
| *Code smells* | 51 |
| Líneas de código | 14.204 |
| Complejidad ciclomática total / cognitiva | 2130 / 803 |

**Cobertura por paquete** (Vitest con v8, pruebas unitarias y de integración con PostGIS):

| Paquete | Líneas cubiertas |
| :-- | :-: |
| `apps/api` | 89,0 % |
| `apps/web` | 94,9 % |
| `packages/contracts` | 98,6 % |
| `packages/platform` | 99,3 % |
| `packages/shared-kernel`, `event-bus`, `api-client` | 100 % |
| Módulos `reports` y `classifier` | 99,4 % y 99,0 % |
| Módulo `notifications` | 98,6 % |
| Módulos `identity`, `verification`, `heatmap`, `subscriptions`, `moderation` y `open-data` | 100 % |
| **Capa `domain` / `application` / `adapters`** | **100 / 99,3 / 99,5 %** |
| **Global** | **95,9 %** |

**Dependency-cruiser:** 0 violaciones. Ningún módulo importa a otro y el dominio solo depende de `shared-kernel`.

## Fiabilidad

| Prueba | Resultado |
| :-- | :-- |
| 3.1 Base detenida 60 s | `503` en `problem+json` durante toda la caída; la API no se cayó y volvió sola a `200` |
| 3.2 Reinicio con reportes en vuelo | 3 corridas con `SIGKILL` a mitad de una ráfaga de 60: 0 reportes ni eventos perdidos o duplicados, también en el caso de un reporte guardado sin respuesta |
| 3.3 Corte de red durante el envío | La PWA reenvía con la misma clave y la API repite su respuesta: 1 solo reporte. La prueba falla si se quita la clave |
| 4 Respaldo y restauración | Diario, tras cada versión y a pedido: `pg_dump` cifrado y restauración con conteos idénticos |

## Eficiencia

Además de los umbrales, la curva de capacidad local muestra margen:
- con unas **100 solicitudes/s**, el p95 es de 39 ms;
- con unas **170 solicitudes/s** el proceso se satura (votar p95 446 ms) por el pool de 5 conexiones (RSK-02), sin
  ningún error.

Es un límite documentado, muy por encima del tráfico esperado del piloto.

## Seguridad

- **ZAP completo** (escaneo activo con token sobre las 15 rutas del contrato): 0 altos y 0 medios, en staging y en
  local; 122 reglas superadas.
- **ZAP baseline:** corre tras cada versión.
- **Revisión manual del OWASP Top 10 (2021):** A01 a A10 con control y prueba.
- **`pnpm audit --prod`:** 0 vulnerabilidades. En desarrollo quedan 3 altas sin parche, todas en herramientas de la
  CI y justificadas en [`owasp-top-10.md`](seguridad/owasp-top-10.md).

## Usabilidad

Prueba con 5 personas que siguen tareas guiadas: crear un reporte, confirmar y suscribirse. Guion, planilla y
cuestionario SUS en [`usabilidad/`](usabilidad/guion.md); resultados en [`resultados.md`](usabilidad/resultados.md).

> **Pendiente:** las sesiones con las 5 personas. Los bloqueos que aparezcan se corrigen antes de cerrar la fase.

Lighthouse CI exige Accesibilidad ≥ 90 en cada CI, y la prueba e2e de accesibilidad (axe-core) no encuentra
infracciones en la pantalla principal ni en las hojas.

## Regresión

La suite completa de Playwright contra staging (9 pruebas, HU-01 a HU-08, instalación y accesibilidad) pasó en la
ejecución `39705521274` del flujo `E2E`, sobre `v2.12.2`. Corre automáticamente después de cada versión.

## Desviaciones aceptadas

| Requisito o prueba | Desviación | Justificación |
| :-- | :-- | :-- |
| RNF-05 Disponibilidad | Se mide en la Fase 13 | Es una métrica del periodo piloto; UptimeRobot ya registra `/health` cada 5 minutos |
| Prueba 1: k6 en staging con 100.000 reportes | Los 100.000 reportes se cargan en local; staging se mide con sus datos reales | Cargar datos sintéticos en staging ensuciaría el mapa público y los datos abiertos; `seed:load` solo admite una base local |
| RNF-13 en dependencias de desarrollo | 3 avisos altos sin parche publicado | Solo corren en la CI con entradas del propio repositorio; nunca llegan a la API ni a la PWA |
