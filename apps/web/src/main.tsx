import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.js';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root');

const consulta = new QueryClient({
  defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: true } },
});

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={consulta}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// Precaché de la app y caché de teselas: la app abre aunque no haya señal.
registerSW({ immediate: true });
