// Sincroniza el monorepo con las carpetas presentes en packages/modules:
// referencias de TypeScript, dependencias de apps/api y el registro de módulos.
// Se ejecuta tras crear un módulo (pnpm gen:module) o tras borrar su carpeta.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const en = (...partes) => path.join(raiz, ...partes);

const COMPARTIDOS = [
  'shared-kernel',
  'contracts',
  'testing',
  'event-bus',
  'platform',
  'api-client',
  'errores-remotos',
];
const APPS = ['api', 'web'];

const leerJson = (archivo) => JSON.parse(readFileSync(archivo, 'utf8'));
const escribirJson = (archivo, datos) =>
  writeFileSync(archivo, `${JSON.stringify(datos, null, 2)}\n`);
const camello = (nombre) => nombre.replace(/-(\w)/g, (_, letra) => letra.toUpperCase());

const carpetaModulos = en('packages/modules');
const modulos = existsSync(carpetaModulos)
  ? readdirSync(carpetaModulos, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(path.join(carpetaModulos, d.name, 'index.ts')))
      .map((d) => d.name)
      .sort()
  : [];

// 1. Referencias de proyecto en la raíz.
const tsRaiz = en('tsconfig.json');
escribirJson(tsRaiz, {
  files: [],
  references: [
    ...COMPARTIDOS.map((p) => ({ path: `packages/${p}` })),
    ...modulos.map((m) => ({ path: `packages/modules/${m}` })),
    ...APPS.filter((a) => existsSync(en('apps', a, 'tsconfig.json'))).map((a) => ({
      path: `apps/${a}`,
    })),
  ],
});

// 2. Referencias y dependencias de la raíz de composición.
const tsApi = en('apps/api/tsconfig.json');
const configApi = leerJson(tsApi);
configApi.references = [
  ...['shared-kernel', 'contracts', 'testing', 'event-bus', 'platform', 'errores-remotos'].map(
    (p) => ({
      path: `../../packages/${p}`,
    }),
  ),
  ...modulos.map((m) => ({ path: `../../packages/modules/${m}` })),
];
escribirJson(tsApi, configApi);

const pkgApi = en('apps/api/package.json');
const paqueteApi = leerJson(pkgApi);
const propias = Object.entries(paqueteApi.dependencies ?? {}).filter(
  ([nombre]) => !nombre.startsWith('@gis/module-'),
);
const deModulos = modulos.map((m) => [`@gis/module-${m}`, 'workspace:*']);
paqueteApi.dependencies = Object.fromEntries(
  [...propias, ...deModulos].sort(([a], [b]) => a.localeCompare(b)),
);
escribirJson(pkgApi, paqueteApi);

// 3. Registro de módulos.
const registro = en('apps/api/src/modules.generated.ts');
writeFileSync(
  registro,
  [
    '// Archivo generado por tools/modules/sync-modules.mjs. No editar a mano.',
    ...modulos.map((m) => `import { ${camello(m)}Modulo } from '@gis/module-${m}';`),
    "import type { DefinicionDeModulo } from '@gis/platform';",
    '',
    `export const modulos: readonly DefinicionDeModulo[] = [${modulos
      .map((m) => `${camello(m)}Modulo`)
      .join(', ')}];`,
    '',
  ].join('\n'),
);

const prettier = en('node_modules/prettier/bin/prettier.cjs');
spawnSync(process.execPath, [prettier, '--write', tsRaiz, tsApi, pkgApi, registro], {
  stdio: 'ignore',
});

console.log(`Módulos sincronizados (${modulos.length}): ${modulos.join(', ') || 'ninguno'}`);
