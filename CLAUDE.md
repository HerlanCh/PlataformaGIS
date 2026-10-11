# Plataforma GIS de alerta temprana — La Paz y El Alto

PWA comunitaria para reportar y consultar incidentes urbanos georreferenciados en tiempo real
(bloqueos, robos, accidentes, infraestructura, jaurías). Proyecto de grado.

## Fuente de verdad

- `docs/ROADMAP.md`: plan completo por fases. **Trabaja una fase a la vez, en orden.**
  No empieces una fase hasta que la anterior cumpla el 100 % de su "Criterio de salida".
- Antes de programar una fase, presenta un plan (modo plan) y espera aprobación.
- Al terminar una fase: marca sus casillas en `docs/ROADMAP.md`, actualiza `docs/trazabilidad.md`
  y deja un resumen en `docs/bitacora.md`.

## Stack (no cambiar sin un ADR nuevo en `docs/adr/`)

- Monorepo pnpm workspaces · TypeScript estricto en todo el stack
- API: Node.js + Fastify + Socket.io · Contratos: Zod (genera OpenAPI)
- BD: PostgreSQL + PostGIS · Drizzle ORM + SQL espacial manual
- Web: React + Vite + vite-plugin-pwa · Leaflet + OpenStreetMap
- Bot: Telegraf · Pruebas: Vitest, Testcontainers, Playwright, k6
- Solo software libre o planes gratuitos. Nunca agregar un servicio de pago.

## Reglas de arquitectura (las verifica dependency-cruiser en CI)

- Monolito modular hexagonal. Cada funcionalidad es un módulo en `packages/modules/<nombre>`
  con `domain/`, `application/`, `adapters/`, `migrations/`, `tests/` e `index.ts`.
- Dentro de un módulo: `adapters → application → domain`. El dominio solo importa `shared-kernel`.
- Un módulo **nunca** importa a otro módulo. Se comunican por eventos versionados de `packages/contracts`.
- Cada módulo es dueño de sus tablas. Sin claves foráneas entre módulos.
- Solo `apps/*` (raíces de composición) importa el `index.ts` de los módulos.
- Cada módulo opcional tiene interruptor `FEATURE_<MODULO>`.
- Para crear un módulo nuevo usa el generador (`pnpm gen:module`), no lo armes a mano.

## Calidad (ISO/IEC 25010) — umbrales obligatorios

- Cobertura: dominio ≥ 95 %, aplicación ≥ 85 %, global ≥ 75 %
- Complejidad ciclomática ≤ 10 por función · Duplicación < 3 %
- API p95 < 300 ms · Difusión de eventos p95 < 2 s · Consultas espaciales p95 < 100 ms
- JS inicial de la PWA < 250 KB comprimido
- Escribe la prueba primero cuando corrijas un error. Nombra las pruebas con el ID de la historia (`HU-03: ...`).

## Privacidad y ética

- Nunca exponer `location` real ni `author_id` en respuestas públicas; solo `public_location`.
- Nunca publicar fotos o descripciones de personas.

## Comandos

> Completar en la Fase 1 cuando existan.

- `pnpm install` · `pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm depcruise`
- `docker compose up -d` (PostGIS local)

## Flujo de Git

- Rama corta por tarea desde `main`, Conventional Commits, PR con CI en verde.
- No hagas commit ni push sin que te lo pida.
