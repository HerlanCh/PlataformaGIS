// Pruebas de extremo a extremo (Fase 8): la PWA contra una API real. En local, contra `pnpm dev`;
// en la CI, contra staging después de cada Release (`.github/workflows/e2e.yml`).
// Variables: BASE_URL (la web) y API_URL (la API que usa esa web).
import { defineConfig, devices } from '@playwright/test';

const enCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  // La API gratuita de staging duerme y tarda en despertar; las pruebas esperan con paciencia.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: enCi ? 1 : 0,
  reporter: enCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    ...devices['Pixel 7'],
    // El Chromium completo sin interfaz: el mínimo (headless-shell) deniega siempre las
    // notificaciones, y HU-08 las necesita.
    channel: 'chromium',
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    trace: 'retain-on-failure',
  },
});
