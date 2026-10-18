import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { CENTRO_LA_PAZ, teselaDe, ZOOM_INICIAL } from './src/domain/geo.js';

/**
 * El mapa abre siempre en el centro de La Paz y su tesela central es el LCP: el HTML la precarga
 * con prioridad alta, en paralelo con el JavaScript. Solo esa: las vecinas competirían por la red.
 */
function precargarTeselaInicial() {
  const { x, y } = teselaDe(CENTRO_LA_PAZ, ZOOM_INICIAL);
  return {
    name: 'precargar-tesela-inicial',
    transformIndexHtml: () => [
      {
        tag: 'link',
        attrs: {
          rel: 'preload',
          as: 'image',
          // Sin `crossorigin`, igual que las `<img>` de Leaflet: así se reutiliza la precarga.
          href: `https://tile.openstreetmap.org/${ZOOM_INICIAL}/${x}/${y}.png`,
          fetchpriority: 'high',
        },
        injectTo: 'head' as const,
      },
    ],
  };
}

export default defineConfig({
  plugins: [
    react(),
    precargarTeselaInicial(),
    VitePWA({
      // Service worker propio (src/sw.ts): precaché, teselas con límite y Background Sync de la cola.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'Alerta La Paz y El Alto',
        short_name: 'Alerta LP',
        description: 'Alerta temprana comunitaria de incidentes urbanos en La Paz y El Alto',
        lang: 'es-BO',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        id: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        categories: ['navigation', 'utilities'],
        // PNG generados con `node tools/iconos/generar.mjs`; la maskable deja el dibujo en la
        // zona segura del 80 %.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**'],
    setupFiles: ['./src/pruebas/preparar.ts'],
  },
});
