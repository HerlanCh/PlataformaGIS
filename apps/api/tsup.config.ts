import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: 'esm',
  target: 'node24',
  clean: true,
  // Los paquetes del monorepo se distribuyen como fuente TypeScript: se empaquetan dentro del bundle.
  noExternal: [/^@gis\//],
  // Las dependencias CommonJS empaquetadas (por ejemplo `web-push`) usan `require` para los
  // módulos de Node; en un bundle ESM no existe, así que se crea uno al inicio.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
