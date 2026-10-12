# [2.0.0](https://github.com/HerlanCh/PlataformaGIS/compare/v1.5.0...v2.0.0) (2026-10-12)


### Code Refactoring

* código en español (clases, funciones, eventos y campos del contrato) ([8182e15](https://github.com/HerlanCh/PlataformaGIS/commit/8182e153c5b3cf841688d2ab77540ffefac7ba73))


### BREAKING CHANGES

* los eventos de integración cambian de nombre y de campos
(ReportCreated.v1 -> ReporteCreado.v1, etc.) sin crear una v2.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

# [1.5.0](https://github.com/HerlanCh/PlataformaGIS/compare/v1.4.0...v1.5.0) (2026-10-12)


### Features

* persistencia de verification, subscriptions y moderation ([1e3f025](https://github.com/HerlanCh/PlataformaGIS/commit/1e3f025519658ceb0a1020dfff270a6ec199d648))

# [1.4.0](https://github.com/HerlanCh/PlataformaGIS/compare/v1.3.0...v1.4.0) (2026-10-12)


### Features

* persistencia de identity y reports sobre PostGIS ([b1b5c81](https://github.com/HerlanCh/PlataformaGIS/commit/b1b5c817531c3aeb40db6254e48f4f3cc7ed2d50))

# [1.3.0](https://github.com/HerlanCh/PlataformaGIS/compare/v1.2.0...v1.3.0) (2026-10-12)


### Features

* infraestructura de persistencia con migraciones reversibles y outbox ([c38d2ef](https://github.com/HerlanCh/PlataformaGIS/commit/c38d2efd8e6e53e07d081975566161c02e74944d))

# [1.2.0](https://github.com/HerlanCh/PlataformaGIS/compare/v1.1.0...v1.2.0) (2026-10-11)


### Features

* modelo de dominio de identity y reports ([3e759c8](https://github.com/HerlanCh/PlataformaGIS/commit/3e759c89b01faffde27133dfc79a308299e0fa2e))
* modelo de dominio de verification ([edd92d5](https://github.com/HerlanCh/PlataformaGIS/commit/edd92d5b7fdf8feea13b46c6f195cf1dde281c5a))

# [1.1.0](https://github.com/HerlanCh/PlataformaGIS/compare/v1.0.0...v1.1.0) (2026-10-11)


### Features

* GeoPoint validado, identificadores y eventos de integración ([70addac](https://github.com/HerlanCh/PlataformaGIS/commit/70addac2306a7fc930377d9a85d8f5b7369f036c))

# 1.0.0 (2026-10-11)


### Bug Fixes

* **platform:** escuchar los errores de conexiones inactivas del pool ([b1bb172](https://github.com/HerlanCh/PlataformaGIS/commit/b1bb172bd5471eef61dc3fe286d921fa13454bbd))


### Features

* crear el monorepo, los paquetes base y la API mínima ([0989375](https://github.com/HerlanCh/PlataformaGIS/commit/0989375aaef904d83d3d62d87fbd4d115118b51e))
* **web:** PWA mínima con mapa de La Paz y ping en tiempo real ([432300e](https://github.com/HerlanCh/PlataformaGIS/commit/432300ebf886f77a038fe56cad69255ddc17ff38))
