import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Alerta La Paz y El Alto',
        short_name: 'Alerta LP',
        description: 'Alerta temprana comunitaria de incidentes urbanos en La Paz y El Alto',
        lang: 'es',
        theme_color: '#0f4c5c',
        background_color: '#ffffff',
        display: 'standalone',
        // Los iconos PNG definitivos llegan con la PWA completa (Fase 8).
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
  },
});
