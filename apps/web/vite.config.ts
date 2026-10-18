import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker propio (src/sw.ts): precaché, teselas con límite y Background Sync de la cola.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
      manifest: {
        name: 'Alerta La Paz y El Alto',
        short_name: 'Alerta LP',
        description: 'Alerta temprana comunitaria de incidentes urbanos en La Paz y El Alto',
        lang: 'es-BO',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        // Los PNG (192, 512 y maskable) llegan con la entrega 8c, junto con la instalación.
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/pruebas/preparar.ts'],
  },
});
