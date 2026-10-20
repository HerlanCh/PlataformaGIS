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

/** Pantallas por ruta. Todo lo demás es el mapa. */
export const PANTALLAS = {
  '/moderacion': PantallaDeModeracion,
  '/datos-abiertos': PantallaDeDatosAbiertos,
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
