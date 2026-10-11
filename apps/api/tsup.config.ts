import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: 'esm',
  target: 'node24',
  clean: true,
  // Los paquetes del monorepo se distribuyen como fuente TypeScript: se empaquetan dentro del bundle.
  noExternal: [/^@gis\//],
});
