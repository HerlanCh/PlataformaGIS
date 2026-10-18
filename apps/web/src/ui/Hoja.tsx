import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { TRAZO } from './iconos.js';

interface PropsHoja {
  readonly abierta: boolean;
  readonly alCerrar: () => void;
  readonly titulo: ReactNode;
  readonly ayuda?: ReactNode;
  readonly children?: ReactNode;
}

/**
 * Hoja modal que sube desde abajo, sobre un velo. Se cierra con su botón, con Escape (lo maneja el
 * <dialog>) o con un toque en el fondo.
 */
export function Hoja({ abierta, alCerrar, titulo, ayuda, children }: PropsHoja) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal?.();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    const alTocarFondo = (e: MouseEvent) => {
      if (e.target === d) alCerrar();
    };
    d.addEventListener('click', alTocarFondo);
    return () => d.removeEventListener('click', alTocarFondo);
  }, [alCerrar]);

  return (
    <dialog ref={dialogo} className="hoja" aria-labelledby={idTitulo} onClose={alCerrar}>
      {abierta && (
        <div className="hoja__contenido">
          <div className="hoja__cabecera">
            <h2 id={idTitulo} className="hoja__titulo">
              {titulo}
            </h2>
            <button type="button" className="boton-redondo" onClick={alCerrar}>
              <X aria-hidden="true" size={22} strokeWidth={TRAZO} />
              <span className="solo-lector">Cerrar</span>
            </button>
          </div>
          {ayuda && <p className="hoja__ayuda">{ayuda}</p>}
          {children}
        </div>
      )}
    </dialog>
  );
}
