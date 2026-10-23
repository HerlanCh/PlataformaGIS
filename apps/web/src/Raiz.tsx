import { lazy, Suspense } from 'react';
import { App } from './App.js';

// Las pantallas aparte del mapa se descargan solo al abrirlas: no pesan en el JS inicial.
const PantallaDeModeracion = lazy(() =>
  import('./features/moderacion/PantallaDeModeracion.js').then((m) => ({
    default: m.PantallaDeModeracion,
  })),
);

const PantallaDeDatosAbiertos = lazy(() =>
  import('./features/datos-abiertos/PantallaDeDatosAbiertos.js').then((m) => ({
    default: m.PantallaDeDatosAbiertos,
  })),
);

const PantallaDePrivacidad = lazy(() =>
  import('./features/legal/PantallasLegales.js').then((m) => ({
    default: m.PantallaDePrivacidad,
  })),
);

const PantallaDeTerminos = lazy(() =>
  import('./features/legal/PantallasLegales.js').then((m) => ({
    default: m.PantallaDeTerminos,
  })),
);

/** Pantallas por ruta. Todo lo demás es el mapa. */
export const PANTALLAS = {
  '/moderacion': PantallaDeModeracion,
  '/datos-abiertos': PantallaDeDatosAbiertos,
  '/privacidad': PantallaDePrivacidad,
  '/terminos': PantallaDeTerminos,
} as const;

export const pantallaDe = (ruta: string) =>
  PANTALLAS[ruta.replace(/\/+$/, '') as keyof typeof PANTALLAS] ?? null;

/** Elige la pantalla según la ruta de la URL. */
export function Raiz({ ruta = globalThis.location.pathname }: { readonly ruta?: string }) {
  const Pantalla = pantallaDe(ruta);
  if (!Pantalla) return <App />;
  return (
    <Suspense fallback={null}>
      <Pantalla />
    </Suspense>
  );
}
