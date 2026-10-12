import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root');

createRoot(raiz).render(
  <StrictMode>
    <App urlApi={import.meta.env.VITE_API_URL ?? 'http://localhost:3000'} />
  </StrictMode>,
);
