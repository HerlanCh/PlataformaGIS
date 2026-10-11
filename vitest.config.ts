import { defineConfig } from 'vitest/config';

const umbral = (porcentaje: number) => ({
  lines: porcentaje,
  functions: porcentaje,
  branches: porcentaje,
  statements: porcentaje,
});

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'packages/modules/*',
      'apps/*',
      { test: { name: 'arquitectura', include: ['tools/architecture/*.test.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/tests/**',
        '**/*.config.ts',
        '**/dist/**',
        '**/*.d.ts',
        // Arranque del proceso y registro generado: sin lógica que probar.
        '**/src/main.{ts,tsx}',
        '**/*.generated.ts',
      ],
      // RNF-04: umbrales por capa.
      thresholds: {
        ...umbral(75),
        '**/domain/**': umbral(95),
        'packages/shared-kernel/**': umbral(95),
        '**/application/**': umbral(85),
      },
    },
  },
});
