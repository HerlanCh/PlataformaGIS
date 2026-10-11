// Reglas de arquitectura (ADR-001, RNF-01). Las rutas son relativas a la raíz del repositorio.
const MODULO = '^packages/modules/([^/]+)/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'dominio-solo-shared-kernel',
      comment:
        'El dominio de un módulo solo importa su propio dominio y shared-kernel: nada de aplicación, adaptadores, librerías ni Node.',
      severity: 'error',
      from: { path: `${MODULO}domain/` },
      to: { pathNot: ['^packages/modules/$1/domain/', '^packages/shared-kernel/'] },
    },
    {
      name: 'aplicacion-no-importa-adaptadores',
      comment: 'La dirección de dependencias es adapters → application → domain.',
      severity: 'error',
      from: { path: `${MODULO}application/` },
      to: { path: ['^packages/modules/[^/]+/adapters/', '^packages/platform/'] },
    },
    {
      name: 'modulo-no-importa-otro-modulo',
      comment:
        'Un módulo nunca importa a otro, tampoco su index.ts. Se comunican por eventos de packages/contracts.',
      severity: 'error',
      from: { path: MODULO },
      to: { path: '^packages/modules/', pathNot: '^packages/modules/$1/' },
    },
    {
      name: 'solo-apps-importan-modulos',
      comment: 'Solo las raíces de composición (apps/*) conocen los módulos.',
      severity: 'error',
      from: { pathNot: ['^apps/', '^packages/modules/'] },
      to: { path: '^packages/modules/' },
    },
    {
      name: 'apps-solo-importan-el-index-del-modulo',
      comment: 'Las apps entran a un módulo únicamente por su index.ts público.',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^packages/modules/[^/]+/', pathNot: '^packages/modules/[^/]+/index\\.ts$' },
    },
    {
      name: 'paquetes-no-importan-apps',
      comment: 'Ningún paquete depende de una aplicación.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'shared-kernel-sin-dependencias',
      comment: 'shared-kernel no depende de nada.',
      severity: 'error',
      from: { path: '^packages/shared-kernel/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^packages/shared-kernel/' },
    },
    {
      name: 'sin-ciclos',
      comment: 'No se permiten dependencias circulares.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['(^|/)dist/', '(^|/)coverage/'] },
    // Las importaciones solo de tipos también cuentan como dependencia.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'default'],
      extensions: ['.ts', '.tsx', '.js'],
    },
  },
};
