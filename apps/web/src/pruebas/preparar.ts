// Preparación de las pruebas de la web: IndexedDB en memoria y limpieza del DOM entre pruebas.
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
