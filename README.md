# Plataforma GIS de alerta temprana — La Paz y El Alto

PWA comunitaria para reportar y consultar incidentes urbanos georreferenciados en tiempo real: bloqueos, robos, accidentes, infraestructura y jaurías. Proyecto de grado.

La plataforma no reemplaza a las líneas de emergencia.

## Requisitos

- Node.js 24 (ver `.nvmrc`)
- pnpm 12
- Docker (base de datos PostGIS local y pruebas de integración)

## Puesta en marcha

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

## Comandos

| Comando          | Qué hace                                    |
| :--------------- | :------------------------------------------ |
| `pnpm dev`       | Arranca las aplicaciones en modo desarrollo |
| `pnpm test`      | Ejecuta las pruebas con cobertura           |
| `pnpm lint`      | ESLint y comprobación de formato            |
| `pnpm typecheck` | Compilación estricta de TypeScript          |
| `pnpm depcruise` | Verifica las reglas de arquitectura         |
| `pnpm build`     | Construye las aplicaciones                  |

## Arquitectura

Monolito modular con arquitectura hexagonal en un monorepo pnpm. Cada funcionalidad es un módulo en `packages/modules/<nombre>` y ningún módulo importa a otro: se comunican por eventos. Las reglas se verifican en la CI con dependency-cruiser.

- Decisiones: [`docs/adr/`](docs/adr/)
- Requisitos: [`docs/srs.md`](docs/srs.md)
- Plan por fases: [`docs/ROADMAP.md`](docs/ROADMAP.md)

## Licencia

[MIT](LICENSE)
