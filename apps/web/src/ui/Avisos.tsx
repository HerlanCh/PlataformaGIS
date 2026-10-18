import { useEffect } from 'react';
import { useEstado } from '../estado.js';

const DURACION_MS = 6000;

/** Aviso breve tras una acción (reporte enviado, pendiente, rechazado). Se anuncia a los lectores. */
export function Avisos() {
  const aviso = useEstado((s) => s.aviso);
  const descartar = useEstado((s) => s.descartarAviso);

  useEffect(() => {
    if (!aviso) return;
    const temporizador = setTimeout(descartar, DURACION_MS);
    return () => clearTimeout(temporizador);
  }, [aviso, descartar]);

  return (
    <div className="avisos" role="status" aria-live="polite">
      {aviso && (
        <p key={aviso.id} className="aviso" data-tono={aviso.tono}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
