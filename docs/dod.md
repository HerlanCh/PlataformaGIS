# Definición de Hecho (Definition of Done - DoD)

Una tarea, historia de usuario o fase se considera **completada (Done)** únicamente cuando satisface la totalidad de los siguientes criterios sin excepción:

---

## 1. Integridad del Código y Arquitectura

- [ ] **Cumplimiento estricto de TypeScript:** Compilación limpia (`pnpm typecheck`) con cero errores en modo estricto (`strict: true`, `noUncheckedIndexedAccess: true`).
- [ ] **Reglas de Arquitectura Hexagonal:** Sin violaciones detectadas por `dependency-cruiser` (`pnpm depcruise`):
  - La dirección de dependencias es estrictamente `adapters → application → domain`.
  - El dominio solo importa `shared-kernel` o contratos base; jamás bibliotecas externas, frameworks o adaptadores.
  - Ningún módulo importa código de otro módulo, tampoco su `index.ts`. La comunicación se realiza mediante eventos de integración; las consultas entre módulos usan un puerto del módulo consumidor que solo la raíz de composición (`apps/*`) conecta.
- [ ] **Complejidad ciclomática:** Ninguna función nueva o modificada excede el valor de 10 (`ESLint complexity`).
- [ ] **Duplicación de código:** Mantenida por debajo del 3 % verificado por `jscpd` o SonarCloud.

---

## 2. Pruebas y Cobertura

- [ ] **Prueba primero en correcciones:** Toda corrección de un error entra con una prueba, escrita antes del arreglo, que reproduce el fallo.
- [ ] **Nomenclatura de pruebas:** Las pruebas asocian explícitamente el ID de la historia de usuario correspondiente (por ejemplo: `describe('HU-03: Confirmar o negar reporte', ...)`).
- [ ] **Umbrales de cobertura superados (`Vitest`):**
  - Capa de Dominio (`domain/`): **≥ 95 %**
  - Capa de Aplicación (`application/`): **≥ 85 %**
  - Global del paquete: **≥ 75 %**
- [ ] **Pruebas de regresión e integración:** Todas las pruebas unitarias y de integración contra base de datos PostGIS (Testcontainers) pasan al 100 % en verde.

---

## 3. Seguridad y Privacidad

- [ ] **Privacidad de datos:** No se expone `author_id` ni coordenadas exactas (`location`) en respuestas públicas; se utiliza `public_location` según `PoliticaDePrivacidad` (RNF-14).
- [ ] **Validación de entradas:** Todos los payloads HTTP, eventos y mensajes entrantes son validados estrictamente mediante esquemas Zod en los adaptadores de entrada.
- [ ] **Auditoría de dependencias:** Cero vulnerabilidades críticas o altas reportadas por `npm audit` y Dependabot.

---

## 4. Documentación y Control de Versiones

- [ ] **Actualización de Trazabilidad:** La matriz en `docs/trazabilidad.md` está actualizada con el nuevo requerimiento, caso de uso y caso de prueba.
- [ ] **Actualización de Roadmap y Bitácora:** Casillas marcadas en `docs/ROADMAP.md` y registro sintético del trabajo en `docs/bitacora.md`.
- [ ] **Commits Convencionales:** Mensajes de commit formateados bajo Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, etc.).
- [ ] **Integración Continua:** Pipeline de GitHub Actions ejecutado y en estado verde.
