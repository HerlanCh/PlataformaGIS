// Instalación de la PWA: en Android y en escritorio el navegador ofrece `beforeinstallprompt`; en
// iPhone hay que agregarla a inicio a mano. Este módulo guarda el aviso del navegador para usarlo
// cuando la persona toque «Instalar app».
import { useSyncExternalStore } from 'react';
import { esIos, estaInstalada } from '../../services/push.js';

interface EventoDeInstalacion extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

let pendiente: EventoDeInstalacion | null = null;
let instalada = false;
const oyentes = new Set<() => void>();
const avisar = () => {
  for (const oyente of oyentes) oyente();
};

/** Se llama al arrancar: el navegador dispara el evento una sola vez y temprano. */
export function escucharInstalacion(): void {
  globalThis.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    pendiente = evento as EventoDeInstalacion;
    avisar();
  });
  globalThis.addEventListener('appinstalled', () => {
    pendiente = null;
    instalada = true;
    avisar();
  });
}

export type FormaDeInstalar =
  'instalada' | 'aviso-del-navegador' | 'pasos-de-ios' | 'no-disponible';

export function formaDeInstalar(): FormaDeInstalar {
  if (instalada || estaInstalada()) return 'instalada';
  if (pendiente) return 'aviso-del-navegador';
  if (esIos()) return 'pasos-de-ios';
  return 'no-disponible';
}

const suscribir = (oyente: () => void) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

/** Cómo se puede instalar la app ahora; se actualiza cuando el navegador lo permite. */
export const useFormaDeInstalar = (): FormaDeInstalar =>
  useSyncExternalStore(suscribir, formaDeInstalar);

/** Muestra el aviso de instalación del navegador. Devuelve si la persona aceptó. */
export async function instalarConElNavegador(): Promise<boolean> {
  if (!pendiente) return false;
  const evento = pendiente;
  pendiente = null;
  avisar();
  await evento.prompt();
  return (await evento.userChoice).outcome === 'accepted';
}

/** Solo para pruebas: vuelve al estado inicial. */
export function reiniciarInstalacion(): void {
  pendiente = null;
  instalada = false;
  avisar();
}
