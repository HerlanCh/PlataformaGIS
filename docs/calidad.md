# Modelo de Calidad y Requisitos No Funcionales (ISO/IEC 25010)

Este documento fija las metas de calidad cuantitativas del sistema bajo el estándar **ISO/IEC 25010**. Cada meta constituye una compuerta automática (*quality gate*) verificada en la integración continua (CI) o en las pruebas de carga.

---

## 1. Prioridades de Calidad

Para la plataforma se priorizan tres características clave:
1. **Mantenibilidad:** Arquitectura modular hexagonal limpia para permitir evolución sin deuda técnica con un equipo reducido.
2. **Fiabilidad:** Tolerancia a caídas de red frecuentes en La Paz y El Alto y disponibilidad en infraestructura gratuita.
3. **Eficiencia de desempeño:** Consultas geoespaciales instantáneas y bajo consumo de ancho de banda en redes móviles (3G/4G).

La **Seguridad y Privacidad** actúa como restricción transversal innegociable.

---

## 2. Matriz de Requisitos No Funcionales (RNF)

| ID | Característica | Subcaracterística | Métrica / Condición | Umbral Obligatorio | Herramienta de Verificación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RNF-01** | Mantenibilidad | Modularidad | Violaciones a la regla de dependencia hexagonal (`adapters → application → domain`, sin importaciones cruzadas entre módulos) | **0 violaciones** | `dependency-cruiser` en CI |
| **RNF-02** | Mantenibilidad | Analizabilidad | Complejidad ciclomática por función | **≤ 10** | ESLint (`complexity`) |
| **RNF-03** | Mantenibilidad | Modificabilidad | Porcentaje de duplicación de código | **< 3 %** | `jscpd` / SonarCloud |
| **RNF-04** | Mantenibilidad | Capacidad de prueba | Cobertura de pruebas unitarias y de integración por capa | **Dominio ≥ 95 %**<br>**Aplicación ≥ 85 %**<br>**Global ≥ 75 %** | `Vitest` + `@vitest/coverage-v8` |
| **RNF-05** | Fiabilidad | Disponibilidad | Tiempo en línea del servicio durante el periodo de prueba piloto | **≥ 95 %** | UptimeRobot (ping cada 5 min a `/health`) |
| **RNF-06** | Fiabilidad | Tolerancia a fallos | Pérdida de reportes creados en la PWA ante corte de conexión | **0 reportes perdidos** (persistidos en `IndexedDB`) | Playwright (simulación offline) |
| **RNF-07** | Fiabilidad | Recuperabilidad | Tiempo y reproducibilidad de restauración de base de datos desde respaldo | **1 restauración exitosa probada por versión** | GitHub Actions + `pg_dump` / `pg_restore` |
| **RNF-08** | Fiabilidad | Ausencia de fallos | Tasa de respuestas HTTP 5xx respecto al total de solicitudes | **< 1.0 %** de solicitudes | Logs estructurados con `pino` |
| **RNF-09** | Eficiencia | Comportamiento temporal | Latencia p95 de endpoints de lectura y creación de reportes | **p95 < 300 ms** (con la carga básica del escenario k6) | `k6` |
| **RNF-10** | Eficiencia | Comportamiento temporal | Latencia de difusión de evento en tiempo real vía WebSocket hacia clientes conectados | **p95 < 2.0 s** (con 500 clientes conectados) | Artillery (motor Socket.io) |
| **RNF-11** | Eficiencia | Comportamiento temporal | Tiempo de ejecución de consultas espaciales en PostGIS con 100.000 reportes | **p95 < 100 ms** (con índice espacial GiST) | PostgreSQL `EXPLAIN ANALYZE` |
| **RNF-12** | Eficiencia | Utilización de recursos | Tamaño total del bundle inicial JavaScript de la PWA | **< 250 KB** (gzipped / brotli) | Vite build + Lighthouse CI |
| **RNF-13** | Seguridad | Confidencialidad / Integridad | Vulnerabilidades críticas o altas en dependencias y código | **0 vulnerabilidades** | `npm audit`, Dependabot, OWASP ZAP |
| **RNF-14** | Seguridad | Confidencialidad (privacidad) | Respuestas públicas (API, WebSocket, datos abiertos) que contienen `location` real o `author_id` | **0 respuestas** | Prueba de privacidad sobre todas las rutas (Vitest) |

RNF-01 a RNF-13 reproducen la tabla ISO/IEC 25010 del roadmap. RNF-14 se añade para dar ID trazable a la regla de privacidad del proyecto.

---

## 3. Criterio de Falla de Integración Continua (CI Quality Gates)

Cualquier Pull Request a la rama `main` será **bloqueado automáticamente** si:
- Existe al menos 1 violación de dependencias reportada por `dependency-cruiser`.
- Alguna función supera la complejidad ciclomática de 10.
- La duplicación de código supera el 3 %.
- La cobertura de código cae por debajo de los umbrales definidos para dominio (95 %) o aplicación (85 %).
- Se detecta una vulnerabilidad alta o crítica en `npm audit`.
- El build de la PWA excede los 250 KB comprimidos para el bundle inicial.
- Alguna respuesta pública contiene `location` o `author_id`.
