import { defineConfig } from 'vitest/config';

const umbral = (porcentaje: number) => ({
  lines: porcentaje,
  functions: porcentaje,
  branches: porcentaje,
  statements: porcentaje,
});

export default defineConfig({
  test: {
    // Un solo PostGIS para toda la ejecución; cada archivo crea su propia base de datos.
    globalSetup: ['packages/testing/src/global-setup.ts'],
    projects: [
      'packages/*',
      'packages/modules/*',
      'apps/*',
      { test: { name: 'arquitectura', include: ['tools/architecture/*.test.ts'] } },
      { test: { name: 'herramientas', include: ['tools/{migraciones,despliegue}/*.test.ts'] } },
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
        '**/src/migrate.ts',
        // Pruebas de extremo a extremo (Playwright) y el service worker, que jsdom no ejecuta:
        // su lógica vive en `services/aviso.ts` y `services/cola.ts`, que sí se prueban.
        '**/e2e/**',
        '**/src/sw.ts',
        // Scripts de carga y medición: se ejecutan contra una base real (`pnpm perf:espacial`).
        '**/rendimiento/cargar-reportes.ts',
        '**/rendimiento/medir-consultas.ts',
        '**/rendimiento/difusion.ts',
        '**/rendimiento/fiabilidad-reinicio.ts',
        // Genera el contrato del cliente (`pnpm gen:api`); lo prueba http.test.ts vía documentoOpenApi.
        '**/openapi/generar.ts',
        '**/*.generated.ts',
        // Infraestructura de pruebas y definiciones de tablas (sin lógica).
        'packages/testing/**',
        '**/schema.ts',
        '**/drizzle.config.ts',
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
