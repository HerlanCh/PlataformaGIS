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
- Pruebas: Vitest, Testcontainers, Playwright, k6 (el bot de Telegram se descartó: ADR-004)
- Solo software libre o planes gratuitos. Nunca agregar un servicio de pago.

## Reglas de arquitectura (las verifica dependency-cruiser en CI)

- Monolito modular hexagonal. Cada funcionalidad es un módulo en `packages/modules/<nombre>`
  con `domain/`, `application/`, `adapters/`, `migrations/`, `tests/` e `index.ts`.
- Dentro de un módulo: `adapters → application → domain`. El dominio solo importa `shared-kernel`.
- Un módulo **nunca** importa a otro módulo. Se comunican por eventos versionados de `packages/contracts`.
- Cada módulo es dueño de sus tablas. Sin claves foráneas entre módulos.
- Tablas y columnas en español (`reportes.caduca_en`). La equivalencia con el código está en
  `adapters/schema.ts` de cada módulo y en `docs/diccionario-datos.md`.
- Solo `apps/*` (raíces de composición) importa el `index.ts` de los módulos.
- Cada módulo opcional tiene interruptor `FEATURE_<MODULO>`.
- Para crear un módulo nuevo usa el generador (`pnpm gen:module`), no lo armes a mano.

## Calidad (ISO/IEC 25010) — umbrales obligatorios

- Cobertura: dominio ≥ 95 %, aplicación ≥ 85 %, global ≥ 75 %
- Complejidad ciclomática ≤ 10 por función · Duplicación < 3 %
- API p95 < 300 ms · Difusión de eventos p95 < 2 s · Consultas espaciales p95 < 100 ms
- JS inicial de la PWA < 250 KB comprimido
- Escribe la prueba primero cuando corrijas un error. Nombra las pruebas con el ID de la historia (`HU-03: ...`).

## Idioma del código

- **Código nuevo en español:** variables, funciones, clases, tipos, archivos, tablas y columnas, sin tildes ni eñes
  en los identificadores (`buscarCercanos`, `ZonaSuscrita`, `caduca_en`). Comentarios y pruebas, en español.
- Todo el código existente ya está en español (renombrado por pedido expreso, ver `docs/bitacora.md`):
  `Reporte`, `buscarPorId`, `caducaEn`. Los miembros y clases nuevos siguen la misma regla.
- Se mantienen en inglés los nombres de los módulos, lo que impone una librería y los campos del contrato del SRS
  (`location`, `public_location`, `author_id`, `idempotency_key`).

## Privacidad y ética

- Nunca exponer `location` real ni `author_id` en respuestas públicas; solo `public_location`
  (columnas `ubicacion`, `id_autor` y `ubicacion_publica`).
- Nunca publicar fotos o descripciones de personas.

## Comandos

Requiere Node 24 y pnpm 12. En bash de Windows, pnpm está en `%APPDATA%\npm`.

- `pnpm install` · `docker compose up -d` (PostGIS local en el puerto **5433**) · `pnpm dev` (API en :3000, web en :5173)
- `pnpm db:migrate` aplica las migraciones pendientes en `DATABASE_URL` (plataforma y módulos activos).
- `pnpm db:generate` genera la migración de avance desde `adapters/schema.ts` de cada módulo. Después hay que
  escribir a mano su reversa `<nombre>.down.sql` y revisar los tipos espaciales (Drizzle Kit omite el SRID).
- `pnpm seed:load [cantidad]` carga reportes y zonas sintéticos (100.000 por defecto) en la base **local**;
  `pnpm perf:espacial` mide las consultas espaciales y regenera `docs/rendimiento/consultas-espaciales.md`.
- `pnpm test` (Vitest con cobertura y umbrales) · `pnpm exec vitest run <ruta>` (una sola prueba)
- `pnpm lint` (ESLint + Prettier) · `pnpm format` · `pnpm typecheck` (`tsc -b`)
- `pnpm depcruise` (reglas de arquitectura) · `pnpm duplication` (jscpd)
- `pnpm build` · `pnpm audit --prod --audit-level high`
- `pnpm moderador:ascender <idUsuario>` da el rol MODERADOR contra `DATABASE_URL`; el usuario ve su id en `/moderacion`.
- `pnpm datos-abiertos:cargar` carga en los datos abiertos los reportes ya terminados (idempotente).
- `pnpm clasificador:evaluar [conjunto.jsonl]` regenera `docs/clasificador/evaluacion.md`; `pnpm clasificador:exportar <archivo>`
  exporta las descripciones moderadas como conjunto etiquetado.
- `pnpm gen:module <nombre>` crea un módulo y lo registra. Para eliminar uno: borrar su carpeta y
  ejecutar `node tools/modules/sync-modules.mjs && pnpm install`.
- `apps/api/src/modules.generated.ts` y las referencias de `tsconfig.json` son generados: no editarlos a mano.
- `pnpm gen:api` regenera el contrato OpenAPI (`packages/api-client/openapi.json`) y los tipos del cliente
  (`esquema.generated.ts`). Hay que ejecutarlo al cambiar una ruta o un esquema de `packages/contracts/src/http.ts`:
  una prueba falla si el contrato guardado no coincide. La API publica Swagger UI en `/docs`.
- `pnpm carga:difusion` mide la difusión en tiempo real: conecta `CLIENTES` sockets (500 por defecto) a `BASE_URL`,
  crea reportes y exige p95 < 2 s, todas las entregas y ninguna a otra zona.
- `pnpm fiabilidad:reinicio` mata la API compilada (base **local**) en plena ráfaga de reportes, la reinicia y exige
  0 reportes o eventos perdidos o duplicados. Requiere `pnpm --filter @gis/api build`.
- Carga básica con k6 (Docker): `docker run --rm -v "$PWD/tools/carga:/carga" -e BASE_URL=<url> grafana/k6:2.3.0 run /carga/api-basica.js`.
  El escenario completo (todas las rutas públicas) es `escenario-completo.js` (`VUS`, `PAUSA_S`, `DURACION`, `SALIDA`); contra la
  API local conviene k6 instalado en la máquina: el reenvío de puertos de Docker Desktop pierde conexiones. Ver
  `docs/rendimiento/verificacion-fase-11.md`.
- Las pruebas de integración (`*.integration.test.ts`) usan PostGIS real con Testcontainers: necesitan Docker.
  Sin Docker se omiten en local; en la CI son obligatorias.
- TypeScript está fijado en la serie 6: typescript-eslint aún no admite la 7.

## Flujo de Git

- Rama corta por tarea desde `main`, Conventional Commits, PR con CI en verde.
- No hagas commit ni push sin que te lo pida.
