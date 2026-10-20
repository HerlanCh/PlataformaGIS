import { useEffect } from 'react';
import { useEstado } from '../estado.js';

const DURACION_MS = 6000;
/** Con una acción el aviso dura más, para dar tiempo a leerlo y tocarla. */
const DURACION_CON_ACCION_MS = 10_000;

/** Aviso breve tras una acción (reporte enviado, pendiente, rechazado). Se anuncia a los lectores. */
export function Avisos() {
  const aviso = useEstado((s) => s.aviso);
  const descartar = useEstado((s) => s.descartarAviso);
  const abrirDescripcion = useEstado((s) => s.abrirDescripcion);

  useEffect(() => {
    if (!aviso) return;
    const duracion = aviso.idParaDescribir ? DURACION_CON_ACCION_MS : DURACION_MS;
    const temporizador = setTimeout(descartar, duracion);
    return () => clearTimeout(temporizador);
  }, [aviso, descartar]);

  const idParaDescribir = aviso?.idParaDescribir;
  return (
    <div className="avisos" role="status" aria-live="polite">
      {aviso && (
        <div key={aviso.id} className="aviso" data-tono={aviso.tono}>
          <p className="aviso__texto">{aviso.texto}</p>
          {idParaDescribir && (
            <button
              type="button"
              className="aviso__accion"
              onClick={() => abrirDescripcion(idParaDescribir)}
            >
              Añadir detalle
            </button>
          )}
        </div>
      )}
    </div>
  );
}
