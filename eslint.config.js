import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/dev-dist/**',
    'tools/architecture/fixtures/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // RNF-02: complejidad ciclomática máxima por función.
      complexity: ['error', 10],
    },
  },
  {
    // Scripts y archivos de configuración que corren en Node.
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Escenarios de k6: corren en su propio motor, con sus variables globales.
    files: ['tools/carga/**/*.js'],
    languageOptions: { globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } },
  },
  prettier,
);
